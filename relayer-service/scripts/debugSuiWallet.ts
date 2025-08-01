#!/usr/bin/env ts-node

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import 'dotenv/config';

async function debugSuiWallet() {
  console.log('🔍 Sui Wallet Debug Tool');
  console.log('========================\n');

  const { SUI_PRIVATE_KEY } = process.env;
  
  if (!SUI_PRIVATE_KEY) {
    console.log('❌ No SUI_PRIVATE_KEY found in environment');
    console.log('Please add SUI_PRIVATE_KEY to your .env file');
    return;
  }

  console.log(`📝 Analyzing private key...`);
  console.log(`   Format: ${SUI_PRIVATE_KEY.startsWith('suiprivkey') ? 'Sui CLI bech32' : 'Unknown'}`);
  console.log(`   Length: ${SUI_PRIVATE_KEY.length} characters`);
  
  const client = new SuiClient({ url: getFullnodeUrl('testnet') });
  
  try {
    let keypair: Ed25519Keypair;
    
    if (SUI_PRIVATE_KEY.startsWith('suiprivkey')) {
      console.log('\n🔧 Parsing Sui CLI bech32 format...');
      const { schema, secretKey } = decodeSuiPrivateKey(SUI_PRIVATE_KEY);
      keypair = Ed25519Keypair.fromSecretKey(secretKey);
      console.log('✅ Successfully parsed suiprivkey format');
      
    } else if (SUI_PRIVATE_KEY.startsWith('0x') || SUI_PRIVATE_KEY.length === 64) {
      console.log('\n🔧 Parsing hex format...');
      const keyBytes = SUI_PRIVATE_KEY.startsWith('0x') 
        ? Buffer.from(SUI_PRIVATE_KEY.slice(2), 'hex')
        : Buffer.from(SUI_PRIVATE_KEY, 'hex');
        
      if (keyBytes.length !== 32) {
        throw new Error(`Expected 32 bytes, got ${keyBytes.length} bytes`);
      }
      
      keypair = Ed25519Keypair.fromSecretKey(keyBytes);
      console.log('✅ Successfully parsed hex format');
      
    } else {
      console.log('\n🔧 Trying base64 format...');
      const keyBuffer = Buffer.from(SUI_PRIVATE_KEY, 'base64');
      console.log(`   Decoded length: ${keyBuffer.length} bytes`);
      
      if (keyBuffer.length === 32) {
        keypair = Ed25519Keypair.fromSecretKey(keyBuffer);
        console.log('✅ Successfully parsed 32-byte base64 key');
      } else if (keyBuffer.length === 52) {
        console.log('🔧 Extracting from 52-byte wallet format...');
        const extracted = keyBuffer.slice(20, 52);
        keypair = Ed25519Keypair.fromSecretKey(extracted);
        console.log('✅ Successfully extracted private key');
      } else {
        throw new Error(`Unexpected key length: ${keyBuffer.length} bytes`);
      }
    }

    // Get address and balance
    const address = keypair.getPublicKey().toSuiAddress();
    const balance = await client.getBalance({
      owner: address,
      coinType: '0x2::sui::SUI'
    });
    
    const suiBalance = (Number(balance.totalBalance) / 1_000_000_000).toFixed(6);
    
    console.log('\n🎯 Wallet Information:');
    console.log(`   Address: ${address}`);
    console.log(`   Balance: ${suiBalance} SUI`);
    
    if (parseFloat(suiBalance) > 0) {
      console.log('\n✅ SUCCESS! Your wallet has funds and the private key is working correctly.');
      console.log('   The demo should work with this configuration.');
    } else {
      console.log('\n⚠️  Your wallet address is correct but has 0 balance.');
      console.log('   Please fund this address with testnet SUI:');
      console.log('   https://docs.sui.io/guides/developer/getting-started/get-coins');
      console.log(`   Or use: sui client faucet --address ${address}`);
    }

  } catch (error: any) {
    console.error('\n❌ Error parsing private key:', error.message);
    
    console.log('\n💡 Suggested fixes:');
    console.log('1. Export your private key from Sui CLI:');
    console.log('   sui keytool export <your-address>');
    console.log('   (This gives you the suiprivkey... format)');
    console.log('');
    console.log('2. Generate a new keypair:');
    console.log('   pnpm sui-key');
    console.log('');
    console.log('3. Supported formats:');
    console.log('   - Sui CLI: suiprivkey1abc... (recommended)');
    console.log('   - Hex: 0x1234... or 1234... (64 characters)');
    console.log('   - Base64: (32 bytes encoded)');
  }
}

if (require.main === module) {
  debugSuiWallet().catch(console.error);
} 