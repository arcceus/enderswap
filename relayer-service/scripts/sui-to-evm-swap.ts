#!/usr/bin/env ts-node

import { setupAndVerify } from './setup-and-verify';
import { SwapOrchestrator } from './lib/swapOrchestrator';

async function main(): Promise<void> {
  console.log('🚀 SUI to EVM Atomic Swap Demo');
  console.log('===============================');
  
  try {
    // Setup and verify environment
    const { config, evmService, suiService } = await setupAndVerify();
    
    // Initialize orchestrator
    const orchestrator = new SwapOrchestrator(evmService, suiService);
    
    // Run SUI to EVM swap demo
    await orchestrator.demonstrateSUIToEVM(
      config.takerAmount,  // SUI amount in MIST (makerAmount in SUI->ETH swap)
      config.makerAmount,  // ETH amount (takerAmount in SUI->ETH swap)
      config.makerEthDestination,
      config.takerSuiDestination
    );
    
    console.log('\n🎉 SUI to EVM swap demo completed successfully!');
    
  } catch (error) {
    console.error('❌ SUI to EVM swap demo failed:', error);
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