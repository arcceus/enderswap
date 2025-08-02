#!/usr/bin/env ts-node

import { setupAndVerify } from './setup-and-verify';
import { SwapOrchestrator } from './lib/swapOrchestrator';
import { sleep } from './lib/blockchain/common';

async function main(): Promise<void> {
  console.log('🌟 EnderSwap HTLC Atomic Swap Demonstration');
  console.log('============================================');
  
  try {
    // Setup and verify environment
    const { config, evmService, suiService } = await setupAndVerify();
    
    // Initialize orchestrator
    const orchestrator = new SwapOrchestrator(evmService, suiService);
    
    console.log('\n🎬 Starting EnderSwap HTLC Atomic Swap Demo');
    console.log('==================================================');
    
    // Demo 1: EVM to SUI
    await orchestrator.demonstrateEVMToSUI(
      config.makerAmount, 
      config.takerAmount,
      config.makerSuiDestination,
      config.takerEthDestination
    );
    
    // Wait between demos
    console.log('\n⏳ Waiting 5 seconds before next demo...');
    await sleep(5000);
    
    // Demo 2: SUI to EVM  
    await orchestrator.demonstrateSUIToEVM(
      config.takerAmount,  // SUI amount in MIST (makerAmount in SUI->ETH swap)
      config.makerAmount,  // ETH amount (takerAmount in SUI->ETH swap)
      config.makerEthDestination,
      config.takerSuiDestination
    );
    
    // Wait between demos
    console.log('\n⏳ Waiting 5 seconds before next demo...');
    await sleep(5000);
    
    // Demo 3: Error handling
    await orchestrator.demonstrateTimelockExpiry();
    
    console.log('\n🎉 All demos completed successfully!');
    console.log('==================================================');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Missing required environment variables')) {
        console.log('\n📝 Please create a .env file with the following variables:');
        console.log('   EVM_PRIVATE_KEY=your_base_sepolia_private_key');
        console.log('   SUI_PRIVATE_KEY=your_sui_private_key_base64');
        console.log('   HTLC_ADDRESS=your_deployed_htlc_contract_address');
        console.log('   SUI_HTLC_PACKAGE_ID=your_sui_htlc_package_id');
        console.log('   MAKER_AMOUNT=0.01  # Optional: ETH amount');
        console.log('   TAKER_AMOUNT=100000000  # Optional: SUI amount in MIST');
        console.log('   # Optional destination addresses for cross-chain swaps:');
        console.log('   TAKER_ETH_DESTINATION=  # ETH address for EVM→SUI swaps');
        console.log('   MAKER_SUI_DESTINATION=  # SUI address for EVM→SUI swaps');
        console.log('   MAKER_ETH_DESTINATION=  # ETH address for SUI→EVM swaps');
        console.log('   TAKER_SUI_DESTINATION=  # SUI address for SUI→EVM swaps');
      } else if (error.message.includes('Invalid HTLC_ADDRESS')) {
        console.log('\n🏠 Contract Address Issue:');
        console.log('   Your HTLC_ADDRESS must be a valid Ethereum address');
        console.log('   Format: 0x followed by 40 hexadecimal characters');
        console.log('   Example: 0x1234567890123456789012345678901234567890');
        console.log('\n📖 Deploy a new contract:');
        console.log('   cd evm');
        console.log('   forge create --rpc-url https://sepolia.base.org --private-key $EVM_PRIVATE_KEY src/HTLC.sol:HTLC');
      } else if (error.message.includes('network does not support ENS')) {
        console.log('\n🌐 ENS Resolution Error:');
        console.log('   This error occurs when the address format is incorrect');
        console.log('   Make sure HTLC_ADDRESS in .env is a valid Ethereum address');
        console.log('   Should start with 0x and be exactly 42 characters long');
      } else if (error.message.includes('Wrong secretKey size')) {
        console.log('\n🔑 SUI private key error:');
        console.log('   Make sure your SUI_PRIVATE_KEY is exactly 32 bytes in base64 format');
        console.log('   Generate a new one: pnpm sui-key');
        console.log('   Convert existing: pnpm sui-key convert <your_key>');
      } else if (error.message.includes('insufficient funds')) {
        console.log('\n💸 Insufficient funds:');
        console.log('   Make sure you have enough ETH on Base Sepolia and SUI on testnet');
        console.log('   Get testnet funds from:');
        console.log('   - Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
        console.log('   - Sui Testnet: https://docs.sui.io/guides/developer/getting-started/get-coins');
      }
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Demo interrupted. Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Demo terminated. Goodbye!');
  process.exit(0);
});

// Run the demo
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} 