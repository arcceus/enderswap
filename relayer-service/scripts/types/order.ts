export interface Order {
  id: string;
  // Maker details (who creates the order)
  makerAddress: string;
  makerChain: 'EVM' | 'SUI';
  makerAmount: string;
  makerLockId: string | null;
  makerLockTx: string | null;
  makerClaimTx: string | null;
  
  // Taker details (who accepts the order)
  takerAddress: string | null;
  takerChain: 'EVM' | 'SUI';
  takerAmount: string;
  takerLockId: string | null;
  takerLockTx: string | null;
  takerClaimTx: string | null;
  
  // Swap details
  secretHash: string | null;
  secret: string | null;
  makerTimelock: number; // 48h for maker
  takerTimelock: number; // 24h for taker
  status: 'CREATED' | 'ACCEPTED' | 'MAKER_LOCKED' | 'TAKER_LOCKED' | 'COMPLETED' | 'REFUNDED' | 'EXPIRED';
  createdAt: number;
}

export interface EVMLock {
  lockId: string;
  depositor: string;
  recipient: string;
  amount: string;
  secretHash: string;
  timelock: number;
  claimed: boolean;
  refunded: boolean;
}

export interface SuiLock {
  objectId: string;
  initiator: string;
  targetAddress: string;
  refundAddress: string;
  amount: string;
  secretHash: string;
  deadline: number;
  claimed: boolean;
  refunded: boolean;
}

export interface SwapConfig {
  evmPrivateKey: string;
  suiPrivateKey: string;
  htlcAddress: string;
  suiHtlcPackageId: string;
  makerAmount: string;
  takerAmount: string;
  // Optional destination addresses for cross-chain swaps
  takerEthDestination?: string;
  makerSuiDestination?: string;
  makerEthDestination?: string;
  takerSuiDestination?: string;
} 