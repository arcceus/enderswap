#!/usr/bin/env ts-node

import { setupAndVerify } from './setup-and-verify';
import { SwapOrchestrator } from './lib/swapOrchestrator';

async function main(): Promise<void> {
  console.log('🚀 Timelock Expiry & Refund Demo');
  console.log('=================================');
  
  try {
    // Setup and verify environment
    const { evmService, suiService } = await setupAndVerify();
    
    // Initialize orchestrator
    const orchestrator = new SwapOrchestrator(evmService, suiService);
    
    // Run timelock expiry demo
    await orchestrator.demonstrateTimelockExpiry();
    
    console.log('\n🎉 Timelock expiry demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Timelock expiry demo failed:', error);
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