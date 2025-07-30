// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract HTLC {
    event EVMDepositLocked(
        bytes32 indexed lockId,
        address indexed depositor,
        address indexed recipient,
        uint256 amount,
        bytes32 secretHash,
        uint256 timelock
    );
    event EVMClaimed(bytes32 indexed lockId, bytes32 secret);
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

    function deposit(
        bytes32 lockId,
        address recipient,
        bytes32 secretHash,
        uint256 timelock
    ) public payable {
        require(msg.value > 0, "Amount must be greater than 0");
        require(locks[lockId].depositor == address(0), "LockId already exists");

        locks[lockId] = Lock({
            depositor: msg.sender,
            recipient: recipient,
            amount: msg.value,
            secretHash: secretHash,
            timelock: block.timestamp + timelock,
            claimed: false,
            refunded: false
        });

        emit EVMDepositLocked(
            lockId,
            msg.sender,
            recipient,
            msg.value,
            secretHash,
            block.timestamp + timelock
        );
    }

    function withdraw(bytes32 lockId, bytes32 secret) public {
        Lock storage lock_ = locks[lockId];
        require(lock_.recipient == msg.sender, "Not the recipient");
        require(!lock_.claimed, "Already claimed");
        require(!lock_.refunded, "Already refunded");
        require(lock_.timelock > block.timestamp, "Timelock expired");
        require(
            lock_.secretHash == keccak256(abi.encodePacked(secret)),
            "Invalid secret"
        );

        lock_.claimed = true;
        (bool sent, ) = msg.sender.call{value: lock_.amount}("");
        require(sent, "Failed to send Ether");

        emit EVMClaimed(lockId, secret);
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