# EnderSwap Relayer Service - P2P Architecture Spec Sheet

This document outlines a conceptual architecture for a Peer-to-Peer (P2P) relayer service, where the service's primary role shifts from being a direct counterparty to facilitating atomic swaps between two users.

## 1. Core Logic: Peer-to-Peer Atomic Swaps

In a P2P model, two users directly execute an atomic swap using Hash Time Locked Contracts (HTLCs) on their respective blockchains. The relayer service acts as a matchmaker and coordinator, not as a participant in the swap itself. All swaps will be atomic and full-fill only.

- **User 1's Goal:** Swap Asset A (on Chain 1) for Asset B (on Chain 2).
- **User 2's Goal (Counterparty):** Swap Asset B (on Chain 2) for Asset A (on Chain 1).
- **Service's Role:**
    *   Facilitate order creation and discovery between users.
    *   Relay necessary swap parameters (e.g., secret hash `H`) between matched users.
    *   Monitor on-chain events and notify clients.
    *   Potentially provide dispute resolution mechanisms (optional for MVP).

## 2. On-Chain Contracts

The underlying HTLC contracts would remain similar, with both users directly interacting with them.

- **EVM:** `evm/src/HTLC.sol` (using `sha256`)
- **Sui:** `sui/htlc/sources/HTLC.move` (using `sha2_256`)

### 2.1 Contract Function Details

#### `evm/src/HTLC.sol` (EVM Contract)

*   **`createLock(bytes32 lockId, address targetAddress, bytes32 hashedSecret, uint256 durationSeconds)`**
    *   **Purpose:** To lock EVM funds, making them available for the `targetAddress` to claim using a `revealedSecret`.
    *   **Caller:** The user initiating the lock (e.g., User 1 or User 2).
    *   **Parameters:**
        *   `lockId`: A unique identifier for the lock.
        *   `targetAddress`: The EVM address of the counterparty who can claim the funds.
        *   `hashedSecret`: The SHA-256 hash of the secret `S`.
        *   `durationSeconds`: The duration (in seconds from the current block timestamp) after which the `depositor` can refund if the funds are not claimed.
    *   **Emits:** `EVMDepositLocked(lockId, depositor, targetAddress, amount, hashedSecret, timelock)`

*   **`redeem(bytes32 lockId, bytes32 revealedSecret)`**
    *   **Purpose:** To claim the locked EVM funds by revealing the `revealedSecret`.
    *   **Caller:** The `targetAddress` of the lock.
    *   **Parameters:**
        *   `lockId`: The `lockId` of the funds to claim.
        *   `revealedSecret`: The actual secret `S` that corresponds to the `hashedSecret`.
    *   **Conditions:** Requires the caller to be the `targetAddress`, the lock not already claimed/refunded, `timelock` not expired, and `sha256(abi.encodePacked(revealedSecret))` to match `hashedSecret`.
    *   **Emits:** `EVMClaimed(lockId, revealedSecret)`

*   **`refund(bytes32 lockId)`**
    *   **Purpose:** To reclaim locked EVM funds if the `timelock` has expired and the funds have not been claimed by the recipient.
    *   **Caller:** The `depositor` of the lock.
    *   **Parameters:**
        *   `lockId`: The `lockId` of the funds to refund.
    *   **Conditions:** Requires the caller to be the `depositor`, the lock not already claimed/refunded, and `timelock` to be expired.
    *   **Emits:** `EVMRefunded(lockId)`

#### `sui/htlc/sources/HTLC.move` (Sui Contract)

*   **`createLock<T>(clock: &Clock, durationMillis: u64, hashedSecret: vector<u8>, targetAddress: address, refund: address, amount: Coin<T>, secret_length: u8, ctx: &mut TxContext)`**
    *   **Purpose:** To create a new hash time lock on Sui, locking a `Coin<T>` asset.
    *   **Caller:** The user initiating the lock (e.g., User 1 or User 2).
    *   **Parameters:**
        *   `clock`: A reference to the Sui system `Clock` object.
        *   `durationMillis`: The duration (in milliseconds) for which the `Coin` is locked. After this, the `refund` address can refund.
        *   `hashedSecret`: The SHA-256 hash of the secret `S`.
        *   `targetAddress`: The Sui address of the counterparty who can redeem the `Coin`.
        *   `refund`: The Sui address that can refund the `Coin` after the `durationMillis` has passed.
        *   `amount`: The `Coin<T>` object to be locked.
        *   `secret_length`: The expected byte length of the secret.
        *   `ctx`: A mutable reference to the transaction context.
    *   **Emits:** `NewLockEvent(lockId, hash, coinId, refund_adr, target_adr, initiator, deadline, duration, secret_length)`
    *   **Notes:** There are convenience functions `createLock_48<T>` (48 hours) and `createLock_24<T>` (24 hours) that wrap this function with default durations.

*   **`redeem<T>(lock: LockObject<T>, revealedSecret: vector<u8>, ctx: &mut TxContext)`**
    *   **Purpose:** To redeem the locked Sui `Coin` by providing the correct `revealedSecret`.
    *   **Caller:** Any address with knowledge of the `revealedSecret` (typically the `targetAddress` / counterparty).
    *   **Parameters:**
        *   `lock`: The `LockObject<T>` to redeem.
        *   `revealedSecret`: The actual secret `S`.
    *   **Conditions:** Requires `revealedSecret.length()` to match `secret_length` and `hash::sha2_256(revealedSecret)` to match `hashedSecret`.
    *   **Emits:** `LockClaimedEvent(lockId, secret, claimer)`

*   **`refund<T>(lock: LockObject<T>, clock: &Clock, ctx: &mut TxContext)`**
    *   **Purpose:** To refund the locked Sui `Coin` if the `deadline` has passed.
    *   **Caller:** The `refund` address, `initiator`, or `targetAddress` of the lock.
    *   **Parameters:**
        *   `lock`: The `LockObject<T>` to refund.
        *   `clock`: A reference to the Sui system `Clock` object.
    *   **Conditions:** Requires the caller to be one of the specified addresses and `clock.timestamp_ms()` to be greater than `lock.deadline`.
    *   **Emits:** `LockRefundedEvent(lockId, signer_)`

## 3. The P2P User Flow

This flow assumes a centralized "order book" or matching service, managed by the relayer, to enable users to find counterparties.

### Flow Overview:

1.  **User 1 (Initiator) Creates Offer:**
    *   User 1 generates a secret `S` and calculates the hash `H`.
    *   User 1 creates an offer to swap Asset A for Asset B on the relayer service. This offer includes:
        *   Amount of Asset A
        *   Desired amount of Asset B
        *   Their address on Chain 2 (where they want to receive Asset B)
        *   The hashed secret `H` (or a hash of `H` to reveal `H` later)
        *   A unique offer ID.

2.  **Relayer Service Lists Offer:**
    *   The service receives the offer and makes it discoverable to other users.

3.  **User 2 (Counterparty) Accepts Offer:**
    *   User 2 browses available offers on the relayer service.
    *   User 2 selects User 1's offer and signals acceptance to the relayer service.
    *   The relayer service then relays the hash `H` to User 2.

4.  **User 1 Locks Funds on Chain 1:**
    *   User 1 calls the appropriate `createLock` (EVM) or `createLock` (Sui) function on the Chain 1 HTLC contract.
    *   The `targetAddress` will be User 2's address on Chain 1.
    *   They use the agreed-upon `H` and a `durationSeconds` (EVM) or `durationMillis` (Sui) suitable for their role (longer timelock for the initiator).

5.  **Relayer Service Monitors and Notifies User 2:**
    *   The relayer service monitors Chain 1 for User 1's lock event (e.g., `EVMDepositLocked` or `NewLockEvent`).
    *   Once confirmed, it notifies User 2 that User 1 has successfully locked their funds.

6.  **User 2 Locks Funds on Chain 2:**
    *   User 2 verifies User 1's lock on Chain 1 (can be done via relayer service or client-side if preferred for stronger P2P). For an MVP, reliance on relayer notification is acceptable.
    *   User 2 calls the appropriate `createLock` (EVM) or `createLock` (Sui) function on the Chain 2 HTLC contract, using the **exact same `H`** received from User 1.
    *   The `targetAddress` will be User 1's address on Chain 2.
    *   They use a shorter `durationSeconds` (EVM) or `durationMillis` (Sui) (e.g., 24 hours) to allow User 1 to claim promptly, but still provide an escape hatch.

7.  **Relayer Service Monitors and Notifies User 1:**
    *   The relayer service monitors Chain 2 for User 2's lock event.
    *   Once confirmed, it notifies User 1 that User 2 has successfully locked their funds.

8.  **User 1 Claims Funds on Chain 2:**
    *   User 1 verifies User 2's lock on Chain 2 (again, can rely on relayer or client-side).
    *   User 1 calls the appropriate `redeem` (EVM) or `redeem` (Sui) function on the Chain 2 HTLC contract, using their original revealed secret `S` to claim the funds.
    *   This action reveals `S` publicly on Chain 2.

9.  **Relayer Service Monitors and Notifies User 2 (and User 2 Claims Funds on Chain 1):**
    *   The relayer service monitors Chain 2 for the revealed secret `S` being revealed (e.g., `EVMClaimed` or `LockClaimedEvent`).
    *   Upon detecting the revealed `S`, the relayer service notifies User 2.
    *   User 2 (or an automated component on User 2's behalf, possibly part of the relayer service for reliability) extracts `S` and calls the appropriate `redeem` (EVM) or `redeem` (Sui) function on the Chain 1 HTLC contract to claim their counterparty's funds.

## 4. Off-Chain Components for P2P (Minimal Viable)

1.  **Order Book / Matching Server:**
    *   Provides API endpoints for users to create, view, and accept swap offers.
    *   Manages the state of active offers and matched swaps. All swaps are full-fill only.
    *   Needs a database to store offer details.

2.  **Notification Service:**
    *   Crucial component for real-time communication.
    *   Monitors **both** EVM and Sui chains for relevant events (e.g., `EVMDepositLocked`, `NewLockEvent`, `EVMClaimed`, `LockClaimedEvent`).
    *   Uses WebSockets or similar mechanisms to push notifications to connected clients (User 1 and User 2) about the status of their swap, including when funds are locked or when a secret is revealed.

3.  **Client-Side Logic:**
    *   Interacting with the order book server (creating/accepting offers).
    *   Responding to notifications from the relayer service.
    *   Initiating on-chain transactions (locking funds, claiming funds, or initiating refunds if necessary).
    *   Generating and managing secrets locally.

## 5. Security Considerations in P2P

- **Front-Running:** This is largely handled by the HTLC design itself, as the secret is revealed publicly only when a claim happens. The relayer service's role in relaying `H` before any funds are locked helps coordinate the initial commitment.
- **Griefing Attacks:** What if a user creates an offer and then never locks funds? How are these stale offers handled? (Timelocks and timeouts are crucial here. The relayer service will need logic to mark offers as expired and remove them from the active list if a user fails to lock funds within a specified time after an offer is accepted).

## 6. Hardcoded Values (for MVP)

- Initial offers could be hardcoded or limited to specific asset pairs and amounts.
- No complex user authentication or reputation system for an MVP. 