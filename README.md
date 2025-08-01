# EnderSwap: EVM <-> Sui Atomic Swaps

A demonstration of a cross-chain, bi-directional atomic swap using Hash Time Locked Contracts (HTLCs) between the Base Sepolia and Sui testnets. 

## Quickstart Guide

To run the demo, follow these steps:

1.  **Navigate to the Relayer Service**:
    ```bash
    cd relayer-service
    ```

2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```

3.  **Set Up Environment**:
    -   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    -   **Edit `.env`** and fill in the following required variables:
        -   `EVM_PRIVATE_KEY`: Your private key for an EVM testnet wallet (e.g., Base Sepolia).
        -   `SUI_PRIVATE_KEY`: Your private key for a Sui testnet wallet.
        -   `HTLC_ADDRESS`: The deployed address of your EVM HTLC contract.
        -   `SUI_HTLC_PACKAGE_ID`: The package ID of your published Sui HTLC module.

4.  **Run the Demo**:
    ```bash
    pnpm demo
    ```

This command will execute the full, bi-directional swap flow, logging each step to the console.


## Key Features

-   **Trustless Swaps**: No central authority or custodian holds user funds.
-   **Bi-Directional**: Supports both EVM-to-Sui and Sui-to-EVM swaps.
-   **Peer-to-Peer**: The architecture is designed for two users to swap directly with each other.
-   **Secure by Design**: Utilizes standard HTLCs with SHA-256 hashing and timelock fallbacks.

## How It Works: The Atomic Swap Flow

An atomic swap requires four addresses to ensure funds are sent to the correct destinations:

-   **Maker**: The user who initiates the swap. They have a source address (where they send from) and a destination address (where they want to receive).
-   **Taker**: The user who accepts the swap. They also have a source and a destination address.

---

### **Flow 1: EVM → SUI Swap**

In this scenario, the **Maker wants to trade ETH for SUI**, and the **Taker wants to trade SUI for ETH**.

1.  **Maker Locks ETH**:
    -   The Maker calls `createLock` on the EVM contract.
    -   **Depositor**: Maker's ETH address.
    -   **Recipient**: Taker's ETH address (where the Taker will receive ETH).
    -   This transaction locks the Maker's ETH and sets a secret hash.

2.  **Taker Locks SUI**:
    -   The Taker sees the ETH lock and calls `createLock` on the Sui contract.
    -   **Initiator**: Taker's SUI address.
    -   **Target**: Maker's SUI address (where the Maker will receive SUI).
    -   This uses the *same secret hash*, ensuring the two locks are linked.

3.  **Maker Claims SUI**:
    -   The Maker calls `redeem` on the Sui contract, providing the secret.
    -   This reveals the secret on-chain and transfers the SUI to the Maker.

4.  **Taker Claims ETH**:
    -   The Taker now sees the revealed secret and calls `redeem` on the EVM contract.
    -   This transfers the locked ETH to the Taker.

The swap is complete! If anything goes wrong, the timelocks ensure both parties can refund their original assets.

---

### **Flow 2: SUI → EVM Swap**

This flow is the reverse. The **Maker wants to trade SUI for ETH**.

1.  **Maker Locks SUI**:
    -   The Maker calls `createLock` on the Sui contract.
    -   **Initiator**: Maker's SUI address.
    -   **Target**: Taker's SUI address.

2.  **Taker Locks ETH**:
    -   The Taker calls `createLock` on the EVM contract.
    -   **Depositor**: Taker's ETH address.
    -   **Recipient**: Maker's ETH address.

3.  **Maker Claims ETH**:
    -   The Maker calls `redeem` on the EVM contract, revealing the secret.

4.  **Taker Claims SUI**:
    -   The Taker uses the revealed secret to call `redeem` on the Sui contract.

## Project Architecture

The project consists of three main components:

1.  **EVM Contracts (`/evm`)**: Solidity smart contracts for the EVM side of the swap, managed with Foundry.
2.  **Sui Contracts (`/sui`)**: Move smart contracts for the Sui side of the swap.
3.  **Relayer Service (`/relayer-service`)**: A TypeScript-based orchestration layer that runs the end-to-end swap logic. It simulates the actions of both the Maker and Taker for demonstration purposes atleast for now.


## Contract Address
```
      
      Base Sepolia: 0xE84DAE5a3a93de0591AaEC0CF07dE81536F25D1b
      Sui testnet: 0x120e546b8763c863a4540aa184cba7ae2778f49a5bd5e138be0bfae52bad98b3

```