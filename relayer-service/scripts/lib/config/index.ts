import 'dotenv/config';
import { SwapConfig } from '../../types/order';

export const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
export const SUI_TESTNET_RPC = 'https://fullnode.testnet.sui.io:443';

export const HTLC_ABI = [
  "event EVMDepositLocked(bytes32 indexed lockId, address indexed depositor, address indexed targetAddress, uint256 amount, bytes32 hashedSecret, uint256 timelock)",
  "event EVMClaimed(bytes32 indexed lockId, bytes32 revealedSecret)",
  "event EVMRefunded(bytes32 indexed lockId)",
  "function createLock(bytes32 lockId, address targetAddress, bytes32 hashedSecret, uint256 durationSeconds) public payable",
  "function redeem(bytes32 lockId, bytes32 revealedSecret) public",
  "function refund(bytes32 lockId) public",
  "function locks(bytes32 lockId) public view returns (address, address, uint256, bytes32, uint256, bool, bool)"
];

export function loadConfig(): SwapConfig {
  const { 
    EVM_PRIVATE_KEY, 
    SUI_PRIVATE_KEY, 
    HTLC_ADDRESS, 
    SUI_HTLC_PACKAGE_ID,
    MAKER_AMOUNT = '0.01',
    TAKER_AMOUNT = '100000000', // 0.1 SUI in MIST
    // Optional destination addresses
    TAKER_ETH_DESTINATION,
    MAKER_SUI_DESTINATION,
    MAKER_ETH_DESTINATION,
    TAKER_SUI_DESTINATION
  } = process.env;

  if (!EVM_PRIVATE_KEY || !SUI_PRIVATE_KEY || !HTLC_ADDRESS || !SUI_HTLC_PACKAGE_ID) {
    throw new Error(`
Missing required environment variables. Please ensure your .env file contains:
- EVM_PRIVATE_KEY: Your Base Sepolia wallet private key
- SUI_PRIVATE_KEY: Your Sui wallet private key (32 bytes, base64 encoded)
- HTLC_ADDRESS: Deployed HTLC contract address on Base Sepolia
- SUI_HTLC_PACKAGE_ID: Published HTLC package ID on Sui Testnet
- MAKER_AMOUNT (optional): ETH amount to swap (default: 0.01)
- TAKER_AMOUNT (optional): SUI amount in MIST (default: 100000000)
- TAKER_ETH_DESTINATION (optional): ETH address for EVM→SUI swaps
- MAKER_SUI_DESTINATION (optional): SUI address for EVM→SUI swaps
- MAKER_ETH_DESTINATION (optional): ETH address for SUI→EVM swaps
- TAKER_SUI_DESTINATION (optional): SUI address for SUI→EVM swaps
    `);
  }

  return {
    evmPrivateKey: EVM_PRIVATE_KEY,
    suiPrivateKey: SUI_PRIVATE_KEY,
    htlcAddress: HTLC_ADDRESS,
    suiHtlcPackageId: SUI_HTLC_PACKAGE_ID,
    makerAmount: MAKER_AMOUNT,
    takerAmount: TAKER_AMOUNT,
    takerEthDestination: TAKER_ETH_DESTINATION || undefined,
    makerSuiDestination: MAKER_SUI_DESTINATION || undefined,
    makerEthDestination: MAKER_ETH_DESTINATION || undefined,
    takerSuiDestination: TAKER_SUI_DESTINATION || undefined
  };
}

export const TIMELOCK_DURATIONS = {
  MAKER: 48 * 60 * 60, // 48 hours in seconds
  TAKER: 24 * 60 * 60  // 24 hours in seconds
} as const; 