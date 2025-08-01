#!/usr/bin/env ts-node

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import crypto from 'crypto';

/**
 * Helper script to generate a properly formatted Sui private key for the demo
 */
function generateSuiKey() {
  console.log('🔑 Generating new Sui Ed25519 keypair...\n');
  
  // Generate a new keypair
  const keypair = new Ed25519Keypair();
  
  // Get the private key as bytes
  const privateKeyBytes = keypair.getSecretKey();
  
  // Convert to base64 (this is what the demo expects)
  const privateKeyBase64 = Buffer.from(privateKeyBytes).toString('base64');
  
  // Get the address
  const address = keypair.getPublicKey().toSuiAddress();
  
  console.log('✅ Generated new Sui keypair:');
  console.log(`   Address: ${address}`);
  console.log(`   Private Key (base64): ${privateKeyBase64}`);
  console.log(`   Private Key length: ${Buffer.from(privateKeyBase64, 'base64').length} bytes`);
  
  console.log('\n📋 Add this to your .env file:');
  console.log(`SUI_PRIVATE_KEY=${privateKeyBase64}`);
  
  console.log('\n💰 Fund this address with testnet SUI:');
  console.log(`   https://docs.sui.io/guides/developer/getting-started/get-coins`);
  console.log(`   Or use: sui client faucet --address ${address}`);
  
  return {
    address,
    privateKeyBase64,
    privateKeyBytes
  };
}

/**
 * Convert an existing private key to the correct format
 */
function convertExistingKey(input: string) {
  console.log('🔧 Converting existing private key...\n');
  
  try {
    let keyBytes: Buffer;
    
    // Try to parse as hex first
    if (input.startsWith('0x')) {
      keyBytes = Buffer.from(input.slice(2), 'hex');
    } else if (input.length === 64) {
      // Assume hex without 0x prefix
      keyBytes = Buffer.from(input, 'hex');
    } else {
      // Try base64
      keyBytes = Buffer.from(input, 'base64');
    }
    
    console.log(`   Input key length: ${keyBytes.length} bytes`);
    
    if (keyBytes.length === 32) {
      // Perfect size
      const keypair = Ed25519Keypair.fromSecretKey(keyBytes);
      const address = keypair.getPublicKey().toSuiAddress();
      const base64Key = keyBytes.toString('base64');
      
      console.log('✅ Key is already the correct format:');
      console.log(`   Address: ${address}`);
      console.log(`   Private Key (base64): ${base64Key}`);
      
      return { address, privateKeyBase64: base64Key };
      
    } else if (keyBytes.length > 32) {
      console.log('⚠️  Key is too long, attempting to extract 32-byte private key...');
      
      // Try common extraction patterns
      const patterns = [
        keyBytes.slice(0, 32),           // First 32 bytes
        keyBytes.slice(-32),             // Last 32 bytes
        keyBytes.slice(20, 52),          // Bytes 20-52 (common wallet format)
        keyBytes.slice(16, 48),          // Bytes 16-48
      ];
      
      for (let i = 0; i < patterns.length; i++) {
        try {
          const extracted = patterns[i];
          const keypair = Ed25519Keypair.fromSecretKey(extracted);
          const address = keypair.getPublicKey().toSuiAddress();
          const base64Key = extracted.toString('base64');
          
          console.log(`✅ Successfully extracted key (pattern ${i + 1}):`);
          console.log(`   Address: ${address}`);
          console.log(`   Private Key (base64): ${base64Key}`);
          
          return { address, privateKeyBase64: base64Key };
        } catch (error) {
          console.log(`   Pattern ${i + 1} failed: ${error}`);
        }
      }
      
      throw new Error('Could not extract valid 32-byte private key from input');
    } else {
      throw new Error(`Key too short: ${keyBytes.length} bytes`);
    }
    
  } catch (error) {
    console.error('❌ Failed to convert key:', error);
    console.log('\n💡 Try generating a new key instead with: pnpm sui-key');
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Generate new key
    generateSuiKey();
  } else if (args[0] === 'convert' && args[1]) {
    // Convert existing key
    convertExistingKey(args[1]);
  } else {
    console.log('🔑 Sui Private Key Helper\n');
    console.log('Usage:');
    console.log('  pnpm sui-key                    # Generate new keypair');
    console.log('  pnpm sui-key convert <key>      # Convert existing key');
    console.log('\nExamples:');
    console.log('  pnpm sui-key convert 0x1234567890abcdef...');
    console.log('  pnpm sui-key convert your_base64_key_here');
  }
}

if (require.main === module) {
  main();
} 