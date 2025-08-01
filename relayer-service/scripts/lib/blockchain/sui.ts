import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { bcs } from '@mysten/sui/bcs';
import { Transaction } from '@mysten/sui/transactions';
import { SuiLock } from '../../types/order';
import { SUI_TESTNET_RPC } from '../config';
import { formatDuration } from './common';

export class SuiService {
  private client: SuiClient;
  private keypair: Ed25519Keypair;
  private packageId: string;

  constructor(privateKey: string, packageId: string) {
    this.client = new SuiClient({ 
      url: process.env.SUI_RPC_URL || SUI_TESTNET_RPC 
    });
    
    // Handle both suiprivkey... format and raw hex format
    this.keypair = this.parsePrivateKey(privateKey);
    this.packageId = packageId;
    
    console.log(`✅ Sui service initialized:`);
    console.log(`   Wallet: ${this.walletAddress}`);
    console.log(`   Package: ${this.packageId}`);
    console.log(`   Network: Sui Testnet`);
  }

  private parsePrivateKey(privateKey: string): Ed25519Keypair {
    if (!privateKey) {
      throw new Error('SUI_PRIVATE_KEY is required');
    }

    try {
      if (privateKey.startsWith('suiprivkey')) {
        // Handle Sui CLI bech32 format (suiprivkey...)
        console.log('🔧 Parsing Sui CLI bech32 private key format');
        const { schema, secretKey } = decodeSuiPrivateKey(privateKey);
        return Ed25519Keypair.fromSecretKey(secretKey);
      } else if (privateKey.startsWith('0x') || privateKey.length === 64) {
        // Handle raw hex format
        console.log('🔧 Parsing hex private key format');
        const keyBytes = privateKey.startsWith('0x') 
          ? Buffer.from(privateKey.slice(2), 'hex')
          : Buffer.from(privateKey, 'hex');
          
        if (keyBytes.length !== 32) {
          throw new Error(`Expected 32 bytes, got ${keyBytes.length} bytes`);
        }
        
        return Ed25519Keypair.fromSecretKey(keyBytes);
      } else {
        // Try base64 format as fallback
        console.log('🔧 Trying base64 private key format');
        const keyBuffer = Buffer.from(privateKey, 'base64');
        
        if (keyBuffer.length === 32) {
          return Ed25519Keypair.fromSecretKey(keyBuffer);
        } else if (keyBuffer.length === 52) {
          // Common wallet export format: 20 bytes prefix + 32 bytes private key
          console.log('🔧 Extracting private key from 52-byte wallet format');
          const extracted = keyBuffer.slice(20, 52);
          return Ed25519Keypair.fromSecretKey(extracted);
        } else {
          throw new Error(`Unexpected key length: ${keyBuffer.length} bytes`);
        }
      }
    } catch (error: any) {
      throw new Error(`
Invalid SUI_PRIVATE_KEY format: ${error.message}

Supported formats:
1. Sui CLI format: suiprivkey... (recommended)
2. Raw hex: 0x1234... or 1234... (64 hex characters)
3. Base64: (32 bytes encoded)

To get the correct format:
- Export from Sui CLI: sui keytool export <address>
- Generate new: sui keytool generate ed25519
- Or use: pnpm sui-key
      `);
    }
  }

  get walletAddress(): string {
    return this.keypair.getPublicKey().toSuiAddress();
  }

  async getBalance(): Promise<string> {
    try {
      const address = this.walletAddress;
      const balance = await this.client.getBalance({
        owner: address,
        coinType: '0x2::sui::SUI'
      });
      
      return (Number(balance.totalBalance) / 1_000_000_000).toString(); // Convert MIST to SUI
    } catch (error) {
      console.error('Error getting Sui balance:', error);
      throw new Error(`Failed to get Sui balance: ${error}`);
    }
  }

  async verifyPackage(): Promise<boolean> {
    try {
      // Try to get the package to verify it exists
      const packageObj = await this.client.getObject({
        id: this.packageId,
        options: {
          showContent: true,
        },
      });
      
      if (packageObj.data) {
        console.log('✅ Sui HTLC package verified and accessible');
        return true;
      } else {
        console.error('❌ Sui HTLC package not found');
        return false;
      }
    } catch (error) {
      console.error('❌ Sui HTLC package verification failed:', error);
      console.log('\nPossible issues:');
      console.log('1. Package not published at this ID');
      console.log('2. Wrong network (should be Sui Testnet)');
      console.log('3. Package ID format incorrect');
      console.log('4. Network connectivity issues');
      return false;
    }
  }

  async createLock(params: {
    duration: number; // in seconds
    secretHash: Buffer;
    targetAddress: string;
    refundAddress: string;
    amount: string; // in MIST
    secretLength: number;
  }): Promise<string> {
    console.log(`🔒 Creating Sui lock...`);
    console.log(`   Target: ${params.targetAddress}`);
    console.log(`   Amount: ${Number(params.amount) / 1_000_000_000} SUI`);
    console.log(`   Duration: ${formatDuration(params.duration)}`);
    console.log(`🐛 DEBUG: SUI createLock received amount: "${params.amount}" (type: ${typeof params.amount})`);

    // Validate that we received a valid SUI amount in MIST (should be a large integer)
    if (params.amount.includes('.')) {
      throw new Error(`❌ SUI amount should be in MIST (integer), but received: "${params.amount}". This looks like an ETH amount!`);
    }

    const tx = new Transaction();
    // Convert string to number before passing to u64
    const amountNum = parseInt(params.amount);
    console.log(`🐛 DEBUG: Converted to number: ${amountNum}`);
    
    if (amountNum < 1000000) { // Less than 0.001 SUI
      console.warn(`⚠️  Warning: SUI amount seems very small: ${amountNum} MIST (${amountNum / 1_000_000_000} SUI)`);
    }
    
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountNum)]);

    // Convert duration from seconds to milliseconds for Sui
    const durationMs = params.duration * 1000;

    tx.moveCall({
      target: `${this.packageId}::htlc::createLock`,
      arguments: [
        tx.object('0x6'), // Clock object
        tx.pure.u64(durationMs),
        tx.pure(bcs.vector(bcs.u8()).serialize(Array.from(params.secretHash))),
        tx.pure.address(params.targetAddress),
        tx.pure.address(params.refundAddress),
        coin,
        tx.pure.u8(params.secretLength)
      ],
      typeArguments: ['0x2::sui::SUI']
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(`Sui transaction failed: ${result.effects?.status.error}`);
    }

    // Find the created lock object
    const lockObject = result.effects.created?.find(obj => 
      obj.owner && typeof obj.owner === 'object' && 'Shared' in obj.owner
    );

    if (!lockObject) {
      throw new Error("Lock object not created on Sui");
    }

    console.log(`   Transaction digest: ${result.digest}`);
    console.log(`   Lock Object ID: ${lockObject.reference.objectId}`);
    console.log(`✅ Sui lock created successfully!`);
    
    return lockObject.reference.objectId;
  }

  async redeem(lockObjectId: string, secret: Buffer): Promise<string> {
    console.log(`🎯 Redeeming from Sui lock: ${lockObjectId}`);
    
    // Verify the lock object exists before attempting redemption
    try {
      console.log(`🔍 Verifying lock object exists...`);
      const lockObject = await this.client.getObject({
        id: lockObjectId,
        options: {
          showContent: true,
          showType: true,
        },
      });
      
      if (!lockObject.data) {
        throw new Error(`Lock object ${lockObjectId} not found. It may not be confirmed yet or may have been consumed.`);
      }
      
      console.log(`✅ Lock object verified: ${lockObject.data.type}`);
    } catch (error) {
      console.error(`❌ Failed to verify lock object:`, error);
      throw error;
    }
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::htlc::redeem`,
      arguments: [
        tx.object(lockObjectId),
        tx.pure(bcs.vector(bcs.u8()).serialize(Array.from(secret))),
      ],
      typeArguments: ['0x2::sui::SUI']
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(`Sui redemption failed: ${result.effects?.status.error}`);
    }

    console.log(`   Transaction digest: ${result.digest}`);
    console.log(`✅ Sui redemption successful!`);
    
    return result.digest;
  }

  async refund(lockObjectId: string): Promise<string> {
    console.log(`↩️ Refunding Sui lock: ${lockObjectId}`);
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::htlc::refund`,
      arguments: [
        tx.object(lockObjectId),
        tx.object('0x6'), // Clock object
      ],
      typeArguments: ['0x2::sui::SUI']
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
      },
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(`Sui refund failed: ${result.effects?.status.error}`);
    }

    console.log(`   Transaction digest: ${result.digest}`);
    console.log(`✅ Sui refund successful!`);
    
    return result.digest;
  }

  async getLock(objectId: string): Promise<SuiLock | null> {
    try {
      const object = await this.client.getObject({
        id: objectId,
        options: {
          showContent: true,
        },
      });

      if (!object.data?.content || object.data.content.dataType !== 'moveObject') {
        return null;
      }

      const fields = (object.data.content as any).fields;
      
      return {
        objectId,
        initiator: fields.initiator,
        targetAddress: fields.target_adr,
        refundAddress: fields.refund_adr,
        amount: fields.coin?.fields?.value || '0',
        secretHash: fields.hashed,
        deadline: Number(fields.deadline),
        claimed: false, // Will be true if object is consumed
        refunded: false // Will be true if object is consumed
      };
    } catch (error) {
      console.error(`Error getting Sui lock ${objectId}:`, error);
      return null;
    }
  }

  // Helper to monitor events
  async getTransactionEvents(digest: string) {
    const events = await this.client.getTransactionBlock({
      digest,
      options: {
        showEvents: true,
      },
    });
    
    return events.events || [];
  }
} 