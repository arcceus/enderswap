# EnderSwap HTLC Atomic Swap Demo

This demo showcases atomic swaps between Base Sepolia (EVM) and Sui Testnet using Hash Time Locked Contracts (HTLCs).

## Features

- ✅ **Bi-directional Swaps**: ETH ↔ SUI atomic swaps
- ✅ **Modular Architecture**: Clean separation of blockchain services
- ✅ **Error Handling**: Timelock expiry and refund scenarios
- ✅ **Real-time Monitoring**: Transaction confirmations and balance updates
- ✅ **Security**: SHA256 hashing with proper timelock durations

## Demo Scenarios

1. **EVM to SUI Swap**: Lock ETH on Base Sepolia → Lock SUI on Sui → Claim SUI → Claim ETH
2. **SUI to EVM Swap**: Lock SUI on Sui → Lock ETH on Base Sepolia → Claim ETH → Claim SUI  
3. **Error Handling**: Timelock expiry and refund demonstration

## Prerequisites

1. **Deployed Contracts**:
   - HTLC contract deployed on Base Sepolia
   - HTLC module published on Sui Testnet

2. **Wallet Setup**:
   - EVM wallet with Base Sepolia ETH
   - Sui wallet with testnet SUI

3. **Testnet Funds**:
   - Get Base Sepolia ETH: [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
   - Get Sui testnet tokens: [Sui Faucet](https://docs.sui.io/guides/developer/getting-started/get-coins)

## Setup

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Create Environment File**:
   ```bash
   cp .env.example .env
   ```

3. **Configure Environment Variables** (see `.env.example`):
   ```bash
   EVM_PRIVATE_KEY=your_base_sepolia_private_key
   SUI_PRIVATE_KEY=your_sui_private_key_base64
   HTLC_ADDRESS=your_deployed_htlc_contract_address
   SUI_HTLC_PACKAGE_ID=your_sui_htlc_package_id
   MAKER_AMOUNT=0.01
   TAKER_AMOUNT=100000000
   ```

## Usage

### Run Individual Scripts via pnpm (Recommended)

1. **Setup and Verification Only**:
   ```bash
   pnpm setup
   ```

2. **EVM to SUI Swap Demo**:
   ```bash
   pnpm evm-to-sui
   ```

3. **SUI to EVM Swap Demo**:
   ```bash
   pnpm sui-to-evm
   ```

4. **Timelock Expiry & Refund Demo**:
   ```bash
   pnpm timelock-demo
   ```

5. **Run All Demos (Replaces Original Demo)**:
   ```bash
   pnpm all-demos
   ```

6. **Original Demo Script**:
   ```bash
   pnpm demo
   ```

### Run with Custom Amounts

You can override the default amounts for any script:
```bash
MAKER_AMOUNT=0.005 TAKER_AMOUNT=50000000 pnpm evm-to-sui
```

### Alternative: Direct ts-node execution

If you prefer to run directly:
```bash
npx ts-node scripts/setup-and-verify.ts
npx ts-node scripts/evm-to-sui-swap.ts
# etc...
```


## Available Scripts

### `setup-and-verify.ts`
- Loads configuration and initializes blockchain services
- Verifies HTLC contracts are accessible on both chains
- Checks wallet balances and provides warnings if insufficient
- Can be imported by other scripts or run standalone

### `evm-to-sui-swap.ts`
- Demonstrates ETH → SUI atomic swap
- Includes setup verification, then runs the complete swap flow
- Shows maker locking ETH, taker locking SUI, claims, and final balances

### `sui-to-evm-swap.ts`
- Demonstrates SUI → ETH atomic swap
- Includes setup verification, then runs the complete swap flow
- Shows maker locking SUI, taker locking ETH, claims, and final balances

### `timelock-expiry-demo.ts`
- Demonstrates error handling for timelock expiry
- Creates a short-lived lock and shows refund after expiry
- Useful for testing refund mechanisms

### `run-all-demos.ts`
- Runs all three demos in sequence (equivalent to original demo.ts)
- Includes 5-second pauses between demos
- Comprehensive demonstration of all features

## Key Components

### SwapOrchestrator
- Orchestrates complete swap flows
- Handles secret generation and revelation
- Manages timelock durations (48h maker, 24h taker)

### EVMService  
- Interacts with HTLC contract on Base Sepolia
- Handles ETH locking, redemption, and refunds
- Monitors transaction confirmations

### SuiService
- Interacts with HTLC module on Sui Testnet  
- Handles SUI locking, redemption, and refunds
- Manages Move object lifecycle

## Security Features

- **SHA256 Hashing**: Compatible between EVM and Sui chains
- **Timelock Protection**: 48h for initiator, 24h for counterparty
- **Atomic Guarantees**: Either both parties get funds or both get refunds
- **Secret Protection**: Secrets only revealed during successful claims

## Troubleshooting

### Common Issues

1. **"Wrong secretKey size" Error**:
   - Ensure SUI_PRIVATE_KEY is exactly 32 bytes in base64 format
   - Export private key from Sui wallet properly

2. **"Insufficient funds" Error**:
   - Get testnet tokens from faucets
   - Ensure sufficient balance for both swap amounts

3. **Transaction Failures**:
   - Check network connectivity
   - Verify contract addresses are correct
   - Ensure contracts are deployed and accessible

### Getting Help

- Check contract deployment status
- Verify RPC endpoints are accessible  
- Ensure wallet addresses have sufficient gas
- Review transaction logs for specific errors

## Development

To extend or modify the demo:

1. **Add New Swap Scenarios**: Extend `SwapOrchestrator` class
2. **Support New Chains**: Create new service classes in `lib/blockchain/`
3. **Custom Logic**: Modify individual service methods
4. **Error Handling**: Enhance error scenarios in orchestrator
 