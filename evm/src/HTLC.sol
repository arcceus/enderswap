// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract HTLC {
    event EVMDepositLocked(
        bytes32 indexed lockId,
        address indexed depositor,
        address indexed targetAddress,
        uint256 amount,
        bytes32 hashedSecret,
        uint256 timelock
    );
    event EVMClaimed(bytes32 indexed lockId, bytes32 revealedSecret);
    event EVMRefunded(bytes32 indexed lockId);

    struct Lock {
        address depositor;
        address recipient;
        uint256 amount;
        bytes32 secretHash;
        uint256 timelock;
        bool claimed;
        bool refunded;
    }

    mapping(bytes32 => Lock) public locks;

    function createLock(
        bytes32 lockId,
        address targetAddress,
        bytes32 hashedSecret,
        uint256 durationSeconds
    ) public payable {
        require(msg.value > 0, "Amount must be greater than 0");
        require(locks[lockId].depositor == address(0), "LockId already exists");

        locks[lockId] = Lock({
            depositor: msg.sender,
            recipient: targetAddress,
            amount: msg.value,
            secretHash: hashedSecret,
            timelock: block.timestamp + durationSeconds,
            claimed: false,
            refunded: false
        });

        emit EVMDepositLocked(
            lockId,
            msg.sender,
            targetAddress,
            msg.value,
            hashedSecret,
            block.timestamp + durationSeconds
        );
    }

    function redeem(bytes32 lockId, bytes32 revealedSecret) public {
        Lock storage lock_ = locks[lockId];
        require(lock_.recipient == msg.sender, "Not the recipient");
        require(!lock_.claimed, "Already claimed");
        require(!lock_.refunded, "Already refunded");
        require(lock_.timelock > block.timestamp, "Timelock expired");
        require(
            lock_.secretHash == sha256(abi.encodePacked(revealedSecret)),
            "Invalid secret"
        );

        lock_.claimed = true;
        (bool sent, ) = msg.sender.call{value: lock_.amount}("");
        require(sent, "Failed to send Ether");

        emit EVMClaimed(lockId, revealedSecret);
    }

    function refund(bytes32 lockId) public {
        Lock storage lock_ = locks[lockId];
        require(lock_.depositor == msg.sender, "Not the depositor");
        require(!lock_.claimed, "Already claimed");
        require(!lock_.refunded, "Already refunded");
        require(lock_.timelock <= block.timestamp, "Timelock not expired");

        lock_.refunded = true;
        (bool sent, ) = msg.sender.call{value: lock_.amount}("");
        require(sent, "Failed to send Ether");

        emit EVMRefunded(lockId);
    }
} 