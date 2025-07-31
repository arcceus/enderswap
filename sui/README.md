# Sui HTLC (Hash Time Locked Contract)

This directory contains a Sui Move implementation of a Hash Time Locked Contract (HTLC).

## What is it?

This smart contract enables atomic swaps of `Coin` types on the Sui network. It is designed to be compatible with the Decred atomic swap protocol, and by extension, many other blockchain projects that use this standard.

An HTLC is a smart contract that locks assets for a period of time. The assets can be redeemed by a specific party if they can provide a cryptographic secret (a preimage) before a deadline. If they fail to do so, the original owner can reclaim their assets after the deadline. This is a fundamental building block for cross-chain atomic swaps.

## How to use it

The typical flow for an atomic swap involves two parties creating HTLCs on two different chains.

1.  **Initiation**: A user locks a certain amount of a `Coin<T>` by calling `create_lock_object`. They provide:
    *   The duration for the lock (`dur`).
    *   The SHA-256 hash of a secret (`hashed`).
    *   The recipient's address (`target`).
    *   A refund address (`refund`).
    *   The `Coin<T>` to be locked (`amount`).
    *   The length of the secret (`secret_length`).

    The contract offers `create_lock_object_24` and `create_lock_object_48` as helpers for 24-hour and 48-hour lock times. Upon creation, a `NewLockEvent` is emitted.

2.  **Redemption**: The counterparty, who knows the secret, can redeem the locked `Coin` by calling the `redeem` function with the correct secret (`secret`). The contract verifies the secret against the stored hash. If they match, the `Coin` is transferred to the `target_adr`. A `LockClaimedEvent` is emitted.

3.  **Refund**: If the `Coin` is not redeemed before the `deadline`, the original creator of the lock (or other authorized parties) can call the `refund` function to get their `Coin` back. A `LockRefundedEvent` is emitted.

## API

### Structs

*   `LockObject<T>`: Represents the HTLC itself, holding all necessary information like deadline, hash, addresses, and the locked `Coin`.

### Functions

*   `create_lock_object<T>(clock: &Clock, dur: u64, hashed: vector<u8>, target: address, refund: address, amount: Coin<T>, secret_length: u8, ctx: &mut TxContext)`: Creates and shares a new `LockObject`.
*   `redeem<T>(lock: LockObject<T>, secret: vector<u8>, ctx: &mut TxContext)`: Redeems the locked `Coin` by providing the secret.
*   `refund<T>(lock: LockObject<T>, clock: &Clock, ctx: &mut TxContext)`: Refunds the locked `Coin` after the deadline has passed.

### Events

*   `NewLockEvent`: Emitted when a new lock is created.
*   `LockClaimedEvent`: Emitted when a lock is successfully redeemed.
*   `LockRefundedEvent`: Emitted when a lock is refunded.

These events are crucial for off-chain services to monitor the status of swaps.

## Security Considerations

As highlighted in the source code:

*   **Regulated Coins**: This contract cannot check if a `Coin` is a regulated asset or if its metadata can be changed during the lock time. It is the responsibility of off-chain applications and users to verify the nature of the assets being swapped.
*   **Counterparty Code**: When participating in a swap, it's crucial to verify that the counterparty's contract on the other chain correctly implements the swap logic and uses the same hashing algorithm (SHA-256). An incorrect implementation could lead to the secret being revealed without the ability to redeem the assets.

This HTLC implementation provides a powerful tool for trustless swaps on Sui, but it should be used with a clear understanding of the surrounding off-chain infrastructure and associated risks. 