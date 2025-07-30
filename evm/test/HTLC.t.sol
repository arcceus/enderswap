// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/HTLC.sol";

contract HTLCTest is Test {
    HTLC htlc;
    address constant depositor = address(0x1);
    address constant recipient = address(0x2);
    bytes32 constant secret = keccak256(abi.encodePacked("secret"));
    bytes32 constant secretHash = keccak256(abi.encodePacked(secret));
    uint256 constant amount = 1 ether;
    uint256 constant timelock = 1 hours;
    bytes32 constant lockId = keccak256(abi.encodePacked("test-lock"));

    function setUp() public {
        htlc = new HTLC();
        vm.deal(depositor, 2 ether);
        vm.deal(recipient, 2 ether);
    }

    function testDeposit() public {
        vm.prank(depositor);
        htlc.deposit{value: amount}(
            lockId,
            recipient,
            secretHash,
            timelock
        );

        (
            address depositor_,
            address recipient_,
            uint256 amount_,
            bytes32 secretHash_,
            uint256 timelock_,
            ,
        ) = htlc.locks(lockId);
        assertEq(depositor_, depositor);
        assertEq(recipient_, recipient);
        assertEq(amount_, amount);
        assertEq(secretHash_, secretHash);
        assertEq(timelock_, block.timestamp + timelock);
    }

    function testWithdraw() public {
        vm.prank(depositor);
        htlc.deposit{value: amount}(
            lockId,
            recipient,
            secretHash,
            timelock
        );

        uint256 balanceBefore = recipient.balance;
        vm.prank(recipient);
        htlc.withdraw(lockId, secret);
        uint256 balanceAfter = recipient.balance;

        assertEq(balanceAfter, balanceBefore + amount);
        (, , , , , bool claimed, ) = htlc.locks(lockId);
        assertTrue(claimed);
    }

    function testWithdrawInvalidSecret() public {
        vm.prank(depositor);
        htlc.deposit{value: amount}(
            lockId,
            recipient,
            secretHash,
            timelock
        );

        vm.prank(recipient);
        vm.expectRevert("Invalid secret");
        htlc.withdraw(lockId, keccak256(abi.encodePacked("invalid")));
    }

    function testWithdrawAfterTimelock() public {
        vm.prank(depositor);
        htlc.deposit{value: amount}(
            lockId,
            recipient,
            secretHash,
            timelock
        );

        vm.warp(block.timestamp + timelock + 1);

        vm.prank(recipient);
        vm.expectRevert("Timelock expired");
        htlc.withdraw(lockId, secret);
    }

    function testRefund() public {
        vm.prank(depositor);
        htlc.deposit{value: amount}(
            lockId,
            recipient,
            secretHash,
            timelock
        );

        vm.warp(block.timestamp + timelock + 1);

        uint256 balanceBefore = depositor.balance;
        vm.prank(depositor);
        htlc.refund(lockId);
        uint256 balanceAfter = depositor.balance;

        assertEq(balanceAfter, balanceBefore + amount);
        (, , , , , , bool refunded) = htlc.locks(lockId);
        assertTrue(refunded);
    }

    function testRefundBeforeTimelock() public {
        vm.prank(depositor);
        htlc.deposit{value: amount}(
            lockId,
            recipient,
            secretHash,
            timelock
        );

        vm.prank(depositor);
        vm.expectRevert("Timelock not expired");
        htlc.refund(lockId);
    }
} 