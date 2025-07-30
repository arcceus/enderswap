# Hashed Timelock Contract (HTLC) for Cross-Chain Swaps

This project provides a Hashed Timelock Contract (HTLC) implemented in Solidity for the Ethereum Virtual Machine (EVM). It is designed to facilitate trustless, cross-chain atomic swaps, specifically for transferring native ETH from an EVM-compatible chain (like Base Sepolia) to a non-EVM chain (like Sui).

## Overview

The HTLC allows a user (the "EVM Maker") to lock a specified amount of ETH in the contract. The funds can only be claimed by a designated recipient (the "Sui User") if they can provide a secret (pre-image) that matches a publicly known hash before a predetermined timelock expires. If the recipient fails to claim the funds in time, the original depositor can reclaim their ETH.

This mechanism ensures that the swap is atomic: either the recipient gets the funds by revealing the secret, or the depositor gets a refund.

## Core Components

### `HTLC.sol`

This is the main smart contract file containing the logic for the HTLC.

#### State Variables

-   `locks`: A public mapping from a `lockId` (a `bytes32` value) to a `Lock` struct.

#### Structs

-   `Lock`: A struct that stores all the information about a specific lock, including:
    -   `depositor`: The address of the user who deposited the ETH.
    -   `recipient`: The address of the user who can claim the ETH.
    -   `amount`: The amount of ETH locked.
    -   `secretHash`: The Keccak256 hash of the secret required to unlock the funds.
    -   `timelock`: The Unix timestamp after which the depositor can claim a refund.
    -   `claimed`: A boolean flag indicating whether the funds have been withdrawn.
    -   `refunded`: A boolean flag indicating whether the funds have been refunded.

#### Functions

-   `deposit(bytes32 lockId, address recipient, bytes32 secretHash, uint256 timelock) public payable`
    -   Allows a user to deposit native ETH into the contract.
    -   **Parameters:**
        -   `lockId`: A unique `bytes32` identifier for the lock.
        -   `recipient`: The address that is authorized to withdraw the funds.
        -   `secretHash`: The Keccak256 hash of the secret.
        -   `timelock`: The duration (in seconds) for which the funds will be locked.
    -   The amount of ETH to be deposited is sent as `msg.value`.

-   `withdraw(bytes32 lockId, bytes32 secret) public`
    -   Allows the `recipient` to claim the locked ETH by providing the correct secret before the timelock expires.
    -   **Parameters:**
        -   `lockId`: The identifier of the lock.
        -   `secret`: The pre-image of the `secretHash`.

-   `refund(bytes32 lockId) public`
    -   Allows the original `depositor` to reclaim their funds if the timelock has expired and the funds have not been claimed.
    -   **Parameters:**
        -   `lockId`: The identifier of the lock.

#### Events

The contract emits events to allow off-chain services (like a Relayer) to monitor the state of swaps efficiently.

-   `EVMDepositLocked(bytes32 indexed lockId, address indexed depositor, address indexed recipient, uint256 amount, bytes32 secretHash, uint256 timelock)`
    -   Emitted when a new deposit is made and funds are locked.

-   `EVMClaimed(bytes32 indexed lockId, bytes32 secret)`
    -   Emitted when a recipient successfully withdraws the funds.

-   `EVMRefunded(bytes32 indexed lockId)`
    -   Emitted when a depositor reclaims their funds after the timelock has expired.

## Testing

The project uses the [Foundry](https://github.com/foundry-rs/foundry) framework for testing. The tests are located in `test/HTLC.t.sol`.

### How to Run Tests

To run the test suite, use the following command:

```bash
forge test
```

The tests cover the following scenarios:
-   Successful deposit.
-   Successful withdrawal by the recipient with the correct secret.
-   Reverted withdrawal attempt with an invalid secret.
-   Reverted withdrawal attempt after the timelock has expired.
-   Successful refund to the depositor after the timelock has expired.
-   Reverted refund attempt before the timelock has expired. 