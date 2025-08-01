import { ethers } from 'ethers';
import { EVMLock } from '../../types/order';
import { BASE_SEPOLIA_RPC, HTLC_ABI } from '../config';
import { formatDuration } from './common';

export class EVMService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor(privateKey: string, contractAddress: string) {
    this.provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    // Validate and normalize the contract address
    const validatedAddress = this.validateContractAddress(contractAddress);
    this.contract = new ethers.Contract(validatedAddress, HTLC_ABI, this.wallet);
    
    console.log(`✅ EVM service initialized:`);
    console.log(`   Wallet: ${this.wallet.address}`);
    console.log(`   Contract: ${validatedAddress}`);
    console.log(`   Network: Base Sepolia (Chain ID: 84532)`);
  }

  private validateContractAddress(address: string): string {
    try {
      // Remove any whitespace
      const trimmed = address.trim();
      
      // Check if it's a valid Ethereum address
      if (!ethers.isAddress(trimmed)) {
        throw new Error(`Invalid Ethereum address format: ${trimmed}`);
      }
      
      // Convert to checksummed address
      const checksummed = ethers.getAddress(trimmed);
      
      // Make sure it's not the zero address
      if (checksummed === ethers.ZeroAddress) {
        throw new Error('Contract address cannot be the zero address');
      }
      
      return checksummed;
      
    } catch (error) {
      throw new Error(`
Invalid HTLC_ADDRESS in your .env file: ${address}

The address must be:
1. A valid Ethereum address (42 characters starting with 0x)
2. Not the zero address (0x0000...)

Examples of valid addresses:
- 0x1234567890123456789012345678901234567890
- 0xA0b86a33E6441f8C687C0BA3e3e0aF6F3A6e9e8A

Please check your deployed HTLC contract address and update your .env file.

Error: ${error}
      `);
    }
  }

  get walletAddress(): string {
    return this.wallet.address;
  }

  get contractAddress(): string {
    return this.contract.target as string;
  }

  async getBalance(): Promise<string> {
    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting EVM balance:', error);
      throw new Error(`Failed to get EVM balance: ${error}`);
    }
  }

  async verifyContract(): Promise<boolean> {
    try {
      // Try to call a view function to verify the contract exists and is correct
      const testLockId = '0x' + '0'.repeat(64); // Zero hash for testing
      await this.contract.locks(testLockId);
      console.log('✅ HTLC contract verified and accessible');
      return true;
    } catch (error) {
      console.error('❌ HTLC contract verification failed:', error);
      console.log('\nPossible issues:');
      console.log('1. Contract not deployed at this address');
      console.log('2. Wrong network (should be Base Sepolia)');
      console.log('3. Contract ABI mismatch');
      console.log('4. Network connectivity issues');
      return false;
    }
  }

  async createLock(params: {
    lockId: string;
    recipient: string;
    secretHash: string;
    timelock: number;
    amount: string;
  }): Promise<string> {
    console.log(`🔒 Creating EVM lock...`);
    console.log(`   Lock ID: ${params.lockId}`);
    console.log(`   Recipient: ${params.recipient}`);
    console.log(`   Amount: ${params.amount} ETH`);
    console.log(`   Timelock: ${formatDuration(params.timelock)}`);

    try {
      // Validate the recipient address to prevent ENS resolution
      const validatedRecipient = this.validateAddress(params.recipient, 'recipient');
      
      const tx = await this.contract.createLock(
        params.lockId,
        validatedRecipient,
        params.secretHash,
        params.timelock,
        { value: ethers.parseEther(params.amount) }
      );

      console.log(`   Transaction hash: ${tx.hash}`);
      const receipt = await this.waitForTransaction(tx.hash);
      console.log(`✅ EVM lock created successfully!`);
      
      return tx.hash;
    } catch (error) {
      console.error('Error creating EVM lock:', error);
      throw new Error(`Failed to create EVM lock: ${error}`);
    }
  }

  private validateAddress(address: string, fieldName: string): string {
    try {
      // Remove any whitespace
      const trimmed = address.trim();
      
      // Check if it's a valid Ethereum address
      if (!ethers.isAddress(trimmed)) {
        throw new Error(`Invalid Ethereum address format for ${fieldName}: ${trimmed}`);
      }
      
      // Convert to checksummed address to ensure proper format
      const checksummed = ethers.getAddress(trimmed);
      
      return checksummed;
      
    } catch (error) {
      throw new Error(`
Invalid ${fieldName} address: ${address}

The address must be:
1. A valid Ethereum address (42 characters starting with 0x)
2. Properly formatted hexadecimal

Current address: ${address}
Error: ${error}
      `);
    }
  }

  async redeem(lockId: string, secret: string): Promise<string> {
    console.log(`🎯 Redeeming from EVM lock: ${lockId}`);
    
    const tx = await this.contract.redeem(lockId, secret);
    console.log(`   Transaction hash: ${tx.hash}`);
    
    const receipt = await this.waitForTransaction(tx.hash);
    console.log(`✅ EVM redemption successful!`);
    
    return tx.hash;
  }

  async refund(lockId: string): Promise<string> {
    console.log(`↩️ Refunding EVM lock: ${lockId}`);
    
    const tx = await this.contract.refund(lockId);
    console.log(`   Transaction hash: ${tx.hash}`);
    
    const receipt = await this.waitForTransaction(tx.hash);
    console.log(`✅ EVM refund successful!`);
    
    return tx.hash;
  }

  async getLock(lockId: string): Promise<EVMLock | null> {
    try {
      const result = await this.contract.locks(lockId);
      const [depositor, recipient, amount, secretHash, timelock, claimed, refunded] = result;
      
      if (depositor === ethers.ZeroAddress) {
        return null;
      }

      return {
        lockId,
        depositor,
        recipient,
        amount: ethers.formatEther(amount),
        secretHash,
        timelock: Number(timelock),
        claimed,
        refunded
      };
    } catch (error) {
      console.error(`Error getting EVM lock ${lockId}:`, error);
      return null;
    }
  }

  async waitForTransaction(txHash: string): Promise<ethers.TransactionReceipt> {
    console.log(`⏳ Waiting for transaction confirmation...`);
    const receipt = await this.provider.waitForTransaction(txHash);
    
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction ${txHash} failed`);
    }
    
    return receipt;
  }

  // Event listeners for monitoring
  onDepositLocked(callback: (event: any) => void) {
    this.contract.on('EVMDepositLocked', callback);
  }

  onClaimed(callback: (event: any) => void) {
    this.contract.on('EVMClaimed', callback);
  }

  onRefunded(callback: (event: any) => void) {
    this.contract.on('EVMRefunded', callback);
  }

  removeAllListeners() {
    this.contract.removeAllListeners();
  }
} 