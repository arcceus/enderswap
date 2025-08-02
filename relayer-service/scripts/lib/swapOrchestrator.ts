import { EVMService } from './blockchain/evm';
import { SuiService } from './blockchain/sui';
import { generateSecret, hashSecret, generateLockId, formatHashForDisplay, formatSecretForDisplay, formatDuration, sleep } from './blockchain/common';

const TIMELOCK_DURATIONS = {
  MAKER: 48 * 60 * 60, // 48 hours
  TAKER: 24 * 60 * 60  // 24 hours
} as const;

/**
 * SwapOrchestrator - Handles cross-chain atomic swaps
 * 
 * ATOMIC SWAP LOGIC (4 addresses total):
 * 
 * For ETH → SUI swap:
 * - Maker: Alice (wants to give ETH, receive SUI)
 *   - Alice_ETH: Source address (has ETH)
 *   - Alice_SUI: Destination address (will receive SUI)
 * - Taker: Bob (wants to give SUI, receive ETH)
 *   - Bob_SUI: Source address (has SUI)  
 *   - Bob_ETH: Destination address (will receive ETH)
 * 
 * Contract Calls:
 * 1. Alice locks ETH: depositor=Alice_ETH, recipient=Bob_ETH
 * 2. Bob locks SUI: initiator=Bob_SUI, target=Alice_SUI
 * 3. Alice claims SUI (reveals secret)
 * 4. Bob claims ETH (using revealed secret)
 * 
 * Note: In demo mode, we use the same wallet for source/destination
 * but in production, users would provide separate addresses.
 */

export class SwapOrchestrator {
  private evmService: EVMService;
  private suiService: SuiService;

  constructor(
    evmService: EVMService,
    suiService: SuiService
  ) {
    this.evmService = evmService;
    this.suiService = suiService;
  }

  // Demo 1: EVM to SUI swap (ETH -> SUI)
  async demonstrateEVMToSUI(
    makerAmount: string, 
    takerAmount: string,
    makerDestinationSuiAddress?: string,
    takerDestinationEthAddress?: string
  ): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 DEMO 1: EVM to SUI Atomic Swap (ETH → SUI)');
    console.log('='.repeat(60));

    // For demo, use same wallet addresses if destinations not provided
    const makerSuiDestination = makerDestinationSuiAddress || this.suiService.walletAddress;
    const takerEthDestination = takerDestinationEthAddress || this.evmService.walletAddress;

    // Step 1: Setup
    const secret = generateSecret();
    const secretHash = hashSecret(secret);
    const lockId = generateLockId(secretHash);

    console.log('\n📋 Swap Details:');
    console.log(`   Maker (ETH Source): ${this.evmService.walletAddress}`);
    console.log(`   Maker (SUI Destination): ${makerSuiDestination}`);
    console.log(`   Taker (SUI Source): ${this.suiService.walletAddress}`);
    console.log(`   Taker (ETH Destination): ${takerEthDestination}`);
    console.log(`   Secret Hash: ${formatHashForDisplay(secretHash)}`);
    console.log(`   Lock ID: ${lockId}`);

    // Step 2: Check balances
    console.log('\n💰 Initial Balances:');
    const evmBalance = await this.evmService.getBalance();
    const suiBalance = await this.suiService.getBalance();
    console.log(`   EVM Wallet: ${evmBalance} ETH`);
    console.log(`   SUI Wallet: ${suiBalance} SUI`);

    // Step 3: Maker locks ETH (48h timelock)
    console.log('\n⏰ Step 1: Maker locks ETH on Base Sepolia (48h timelock)');
    const evmTxHash = await this.evmService.createLock({
      lockId,
      recipient: takerEthDestination, // Taker's ETH destination address
      secretHash: formatHashForDisplay(secretHash),
      timelock: TIMELOCK_DURATIONS.MAKER,
      amount: makerAmount
    });

    // Step 4: Taker locks SUI (24h timelock)
    console.log('\n⏰ Step 2: Taker locks SUI on Sui Testnet (24h timelock)');
    const suiLockId = await this.suiService.createLock({
      duration: TIMELOCK_DURATIONS.TAKER,
      secretHash,
      targetAddress: makerSuiDestination, // Maker's SUI destination address
      refundAddress: this.suiService.walletAddress,
      amount: takerAmount,
      secretLength: 32
    });

    // Wait for SUI object to be confirmed and available
    console.log('\n⏳ Waiting 3 seconds for SUI lock to be confirmed...');
    await sleep(3000);

    // Step 5: Maker claims SUI (reveals secret)
    console.log('\n🎯 Step 3: Maker claims SUI (revealing secret)');
    console.log(`   Secret: ${formatSecretForDisplay(secret)}`);
    const suiClaimTx = await this.suiService.redeem(suiLockId, secret);

    // Step 6: Taker claims ETH (using revealed secret)
    console.log('\n🎯 Step 4: Taker claims ETH using revealed secret');
    const evmClaimTx = await this.evmService.redeem(lockId, formatSecretForDisplay(secret));

    // Step 7: Final balances
    console.log('\n💰 Final Balances:');
    const finalEvmBalance = await this.evmService.getBalance();
    const finalSuiBalance = await this.suiService.getBalance();
    console.log(`   EVM Wallet: ${finalEvmBalance} ETH`);
    console.log(`   SUI Wallet: ${finalSuiBalance} SUI`);

    console.log('\n✅ EVM to SUI swap completed successfully!');
    console.log(`   EVM Lock Transaction: ${evmTxHash}`);
    console.log(`   SUI Lock Object: ${suiLockId}`);
    console.log(`   SUI Claim Transaction: ${suiClaimTx}`);
    console.log(`   EVM Claim Transaction: ${evmClaimTx}`);
  }

  // Demo 2: SUI to EVM swap (SUI -> ETH)
  async demonstrateSUIToEVM(
    makerAmount: string, 
    takerAmount: string,
    makerDestinationEthAddress?: string,
    takerDestinationSuiAddress?: string
  ): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 DEMO 2: SUI to EVM Atomic Swap (SUI → ETH)');
    console.log('='.repeat(60));

    // For demo, use same wallet addresses if destinations not provided
    const makerEthDestination = makerDestinationEthAddress || this.evmService.walletAddress;
    const takerSuiDestination = takerDestinationSuiAddress || this.suiService.walletAddress;

    // Step 1: Setup
    const secret = generateSecret();
    const secretHash = hashSecret(secret);
    const lockId = generateLockId(secretHash);

    console.log('\n📋 Swap Details:');
    console.log(`   Maker (SUI Source): ${this.suiService.walletAddress}`);
    console.log(`   Maker (ETH Destination): ${makerEthDestination}`);
    console.log(`   Taker (ETH Source): ${this.evmService.walletAddress}`);
    console.log(`   Taker (SUI Destination): ${takerSuiDestination}`);
    console.log(`   Secret Hash: ${formatHashForDisplay(secretHash)}`);
    console.log(`   Lock ID: ${lockId}`);

    // Step 2: Check balances
    console.log('\n💰 Initial Balances:');
    const evmBalance = await this.evmService.getBalance();
    const suiBalance = await this.suiService.getBalance();
    console.log(`   EVM Wallet: ${evmBalance} ETH`);
    console.log(`   SUI Wallet: ${suiBalance} SUI`);

    // Step 3: Maker locks SUI (48h timelock)
    console.log('\n⏰ Step 1: Maker locks SUI on Sui Testnet (48h timelock)');
    const suiLockId = await this.suiService.createLock({
      duration: TIMELOCK_DURATIONS.MAKER,
      secretHash,
      targetAddress: takerSuiDestination, // Taker's SUI destination address
      refundAddress: this.suiService.walletAddress,
      amount: makerAmount,
      secretLength: 32
    });

    // Step 4: Taker locks ETH (24h timelock)
    console.log('\n⏰ Step 2: Taker locks ETH on Base Sepolia (24h timelock)');
    const evmTxHash = await this.evmService.createLock({
      lockId,
      recipient: makerEthDestination, // Maker's ETH destination address
      secretHash: formatHashForDisplay(secretHash),
      timelock: TIMELOCK_DURATIONS.TAKER,
      amount: takerAmount
    });

    // Step 5: Maker claims ETH (reveals secret)
    console.log('\n🎯 Step 3: Maker claims ETH (revealing secret)');
    console.log(`   Secret: ${formatSecretForDisplay(secret)}`);
    const evmClaimTx = await this.evmService.redeem(lockId, formatSecretForDisplay(secret));

    // Step 6: Taker claims SUI (using revealed secret)
    console.log('\n🎯 Step 4: Taker claims SUI using revealed secret');
    const suiClaimTx = await this.suiService.redeem(suiLockId, secret);

    // Step 7: Final balances
    console.log('\n💰 Final Balances:');
    const finalEvmBalance = await this.evmService.getBalance();
    const finalSuiBalance = await this.suiService.getBalance();
    console.log(`   EVM Wallet: ${finalEvmBalance} ETH`);
    console.log(`   SUI Wallet: ${finalSuiBalance} SUI`);

    console.log('\n✅ SUI to EVM swap completed successfully!');
    console.log(`   SUI Lock Object: ${suiLockId}`);
    console.log(`   EVM Lock Transaction: ${evmTxHash}`);
    console.log(`   EVM Claim Transaction: ${evmClaimTx}`);
    console.log(`   SUI Claim Transaction: ${suiClaimTx}`);
  }

  // Demo 3: Error handling - timelock expiry
  async demonstrateTimelockExpiry(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 DEMO 3: Error Handling - Timelock Expiry & Refund');
    console.log('='.repeat(60));

    const secret = generateSecret();
    const secretHash = hashSecret(secret);
    const lockId = generateLockId(secretHash);

    console.log('\n📋 Creating short timelock for demo purposes...');
    console.log(`   Lock ID: ${lockId}`);

    // Create a lock with very short timelock (30 seconds for demo)
    console.log('\n🔒 Creating EVM lock with 30 second timelock...');
    const shortTimelock = 30; // 30 seconds
    
    const evmTxHash = await this.evmService.createLock({
      lockId,
      recipient: this.evmService.walletAddress, // Use ETH address for demo
      secretHash: formatHashForDisplay(secretHash),
      timelock: shortTimelock,
      amount: '0.001' // Small amount for demo
    });

    console.log('\n⏳ Waiting for timelock to expire...');
    await sleep((shortTimelock + 5) * 1000); // Wait for expiry + buffer

    console.log('\n↩️ Attempting refund after timelock expiry...');
    try {
      const refundTx = await this.evmService.refund(lockId);
      console.log('✅ Refund successful!');
      console.log(`   Refund Transaction: ${refundTx}`);
    } catch (error) {
      console.error('❌ Refund failed:', error);
    }
  }

  async runFullDemo(config: { 
    makerAmount: string; 
    takerAmount: string;
    takerEthDestination?: string;
    makerSuiDestination?: string;
    makerEthDestination?: string;
    takerSuiDestination?: string;
  }): Promise<void> {
    console.log('\n🎬 Starting EnderSwap HTLC Atomic Swap Demo');
    console.log('==================================================');
    
    try {
      // Demo 1: EVM to SUI
      await this.demonstrateEVMToSUI(
        config.makerAmount, 
        config.takerAmount,
        config.makerSuiDestination,
        config.takerEthDestination
      );
      
      // Wait between demos
      console.log('\n⏳ Waiting 5 seconds before next demo...');
      await sleep(5000);
      
      // Demo 2: SUI to EVM  
      await this.demonstrateSUIToEVM(
        config.takerAmount,  // SUI amount in MIST (makerAmount in SUI->ETH swap)
        config.makerAmount,  // ETH amount (takerAmount in SUI->ETH swap)
        config.makerEthDestination,
        config.takerSuiDestination
      );
      
      // Wait between demos
      console.log('\n⏳ Waiting 5 seconds before next demo...');
      await sleep(5000);
      
      // Demo 3: Error handling
      await this.demonstrateTimelockExpiry();
      
      console.log('\n🎉 All demos completed successfully!');
      console.log('==================================================');
      
    } catch (error) {
      console.error('\n❌ Demo failed:', error);
      throw error;
    }
  }
} 