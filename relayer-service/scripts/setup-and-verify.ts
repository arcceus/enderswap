#!/usr/bin/env ts-node

import { loadConfig } from './lib/config';
import { EVMService } from './lib/blockchain/evm';
import { SuiService } from './lib/blockchain/sui';

export interface SetupResult {
  config: ReturnType<typeof loadConfig>;
  evmService: EVMService;
  suiService: SuiService;
}

async function main(): Promise<void> {
  console.log('🌟 EnderSwap Setup and Verification');
  console.log('====================================');
  
  try {
    const result = await setupAndVerify();
    
    console.log('\n✅ Setup and verification completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   EVM Wallet: ${result.evmService.walletAddress}`);
    console.log(`   SUI Wallet: ${result.suiService.walletAddress}`);
    console.log(`   HTLC Contract: ${result.evmService.contractAddress}`);
    console.log(`   SUI Package: ${result.config.suiHtlcPackageId}`);
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    handleSetupError(error);
    process.exit(1);
  }
}

export async function setupAndVerify(): Promise<SetupResult> {
  // Load configuration from environment
  console.log('📋 Loading configuration...');
  const config = loadConfig();
  
  // Initialize services
  console.log('🔧 Initializing blockchain services...');
  const evmService = new EVMService(config.evmPrivateKey, config.htlcAddress);
  const suiService = new SuiService(config.suiPrivateKey, config.suiHtlcPackageId);
  
  // Display wallet information
  console.log('\n💼 Wallet Information:');
  console.log(`   EVM Wallet: ${evmService.walletAddress}`);
  console.log(`   SUI Wallet: ${suiService.walletAddress}`);
  console.log(`   HTLC Contract: ${evmService.contractAddress}`);
  console.log(`   SUI Package: ${config.suiHtlcPackageId}`);
  
  // Verify contracts are accessible
  console.log('\n🔍 Verifying contract accessibility...');
  const evmVerified = await evmService.verifyContract();
  if (!evmVerified) {
    console.error('❌ EVM HTLC contract verification failed!');
    console.log('\n🛠️  Please check:');
    console.log('   1. HTLC_ADDRESS is correct in your .env file');
    console.log('   2. Contract is deployed on Base Sepolia');
    console.log('   3. Network connectivity to Base Sepolia RPC');
    console.log('\n📖 Deploy contract with:');
    console.log('   cd evm && forge create --rpc-url https://sepolia.base.org --private-key $EVM_PRIVATE_KEY src/HTLC.sol:HTLC');
    throw new Error('EVM HTLC contract verification failed');
  }
  
  const suiVerified = await suiService.verifyPackage();
  if (!suiVerified) {
    console.error('❌ Sui HTLC package verification failed!');
    console.log('\n🛠️  Please check:');
    console.log('   1. SUI_HTLC_PACKAGE_ID is correct in your .env file');
    console.log('   2. Package is published on Sui Testnet');
    console.log('   3. Network connectivity to Sui Testnet RPC');
    console.log('\n📖 Publish package with:');
    console.log('   cd sui/htlc && sui client publish --gas-budget 20000000');
    throw new Error('Sui HTLC package verification failed');
  }
  
  // Check initial balances
  console.log('\n💰 Initial Balances:');
  try {
    const evmBalance = await evmService.getBalance();
    const suiBalance = await suiService.getBalance();
    console.log(`   EVM Balance: ${evmBalance} ETH`);
    console.log(`   SUI Balance: ${suiBalance} SUI`);
    
    // Check if we have sufficient balance
    const requiredEth = parseFloat(config.makerAmount);
    const requiredSui = parseFloat(config.takerAmount) / 1_000_000_000; // Convert MIST to SUI
    
    if (parseFloat(evmBalance) < requiredEth * 2) {
      console.warn(`⚠️  Warning: Low ETH balance. Need at least ${requiredEth * 2} ETH for demos`);
      console.log('   Get Base Sepolia ETH: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
    }
    
    if (parseFloat(suiBalance) < requiredSui * 2) {
      console.warn(`⚠️  Warning: Low SUI balance. Need at least ${requiredSui * 2} SUI for demos`);
      console.log('   Get Sui testnet tokens: https://docs.sui.io/guides/developer/getting-started/get-coins');
    }
  } catch (error) {
    console.warn('⚠️  Could not check balances:', error);
  }
  
  return { config, evmService, suiService };
}

function handleSetupError(error: any): void {
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
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Setup interrupted. Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Setup terminated. Goodbye!');
  process.exit(0);
});

// Run the setup
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} 