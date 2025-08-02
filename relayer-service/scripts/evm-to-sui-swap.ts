#!/usr/bin/env ts-node

import { setupAndVerify } from './setup-and-verify';
import { SwapOrchestrator } from './lib/swapOrchestrator';

async function main(): Promise<void> {
  console.log('🚀 EVM to SUI Atomic Swap Demo');
  console.log('===============================');
  
  try {
    // Setup and verify environment
    const { config, evmService, suiService } = await setupAndVerify();
    
    // Initialize orchestrator
    const orchestrator = new SwapOrchestrator(evmService, suiService);
    
    // Run EVM to SUI swap demo
    await orchestrator.demonstrateEVMToSUI(
      config.makerAmount,
      config.takerAmount,
      config.makerSuiDestination,
      config.takerEthDestination
    );
    
    console.log('\n🎉 EVM to SUI swap demo completed successfully!');
    
  } catch (error) {
    console.error('❌ EVM to SUI swap demo failed:', error);
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