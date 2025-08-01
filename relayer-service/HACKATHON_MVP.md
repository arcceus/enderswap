# EnderSwap P2P Hackathon MVP (2-Day Plan)

## Core Features
- Bi-directional order creation and discovery (EVM↔Sui and Sui↔EVM)
- Atomic swap execution using HTLCs
- Real-time swap status monitoring
- Simple but functional UI

## Day 1: Next.js Setup & Core Logic

### Morning: Next.js Setup & API Routes (2-3 hours)
```typescript
// types/order.ts
interface Order {
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

// lib/store.ts (in-memory storage using singleton pattern)
class OrderStore {
  private static instance: OrderStore;
  private orders: Map<string, Order>;
  private ordersByMaker: Map<string, Set<string>>;
  private ordersByTaker: Map<string, Set<string>>;

  private constructor() {
    this.orders = new Map();
    this.ordersByMaker = new Map();
    this.ordersByTaker = new Map();
  }

  static getInstance(): OrderStore {
    if (!OrderStore.instance) {
      OrderStore.instance = new OrderStore();
    }
    return OrderStore.instance;
  }

  // Methods for order management
  addOrder(order: Order) {
    this.orders.set(order.id, order);
    this.ordersByMaker.set(order.makerAddress, new Set([...this.ordersByMaker.get(order.makerAddress) || [], order.id]));
  }
  getOrder(id: string) {
    return this.orders.get(id);
  }
  listOrders() {
    return Array.from(this.orders.values());
  }
  listOrdersByChain(chain: 'EVM' | 'SUI') {
    return this.listOrders().filter(order => 
      // Show orders where the requested chain matches the taker's chain
      order.takerChain === chain && !order.takerAddress
    );
  }
  updateOrder(id: string, updates: Partial<Order>) {
    const order = this.orders.get(id);
    if (order) {
      Object.assign(order, updates);
      if (updates.takerAddress) {
        this.ordersByTaker.set(updates.takerAddress, new Set([...this.ordersByTaker.get(updates.takerAddress) || [], id]));
      }
    }
  }
}
```

- [ ] Set up Next.js 13+ with TypeScript and TailwindCSS
- [ ] Implement API routes:
  - `pages/api/orders/index.ts` (POST/GET)
  - `pages/api/orders/[id].ts` (GET/PUT)
  - `pages/api/orders/[id]/accept.ts` (POST)
- [ ] Set up WebSocket using `next-websocket`

### Afternoon: Blockchain Integration (4-5 hours)
```typescript
// lib/blockchain/common.ts
export const generateSecret = () => crypto.randomBytes(32);
export const hashSecret = (secret: Buffer) => sha256(secret);

// lib/blockchain/evm.ts
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

export class EVMService {
  async createLock(params: {
    lockId: string;
    recipient: string;
    secretHash: string;
    timelock: number;
    amount: string;
  }) {/* ... */}
  
  async withdraw(lockId: string, secret: string) {/* ... */}
  async refund(lockId: string) {/* ... */}
  async getLock(lockId: string): Promise<EVMLock> {/* ... */}
  
  // Event listeners
  onDepositLocked(callback: (event: EVMDepositLockedEvent) => void) {/* ... */}
  onClaimed(callback: (event: EVMClaimedEvent) => void) {/* ... */}
  onRefunded(callback: (event: EVMRefundedEvent) => void) {/* ... */}
}

// lib/blockchain/sui.ts
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

export class SuiService {
  async createLock(params: {
    duration: number; // 24h or 48h
    secretHash: string;
    targetAddress: string;
    refundAddress: string;
    amount: string;
    secretLength: number;
  }) {/* ... */}
  
  async redeem(objectId: string, secret: string) {/* ... */}
  async refund(objectId: string) {/* ... */}
  async getLock(objectId: string): Promise<SuiLock> {/* ... */}
  
  // Event listeners
  onNewLock(callback: (event: NewLockEvent) => void) {/* ... */}
  onLockClaimed(callback: (event: LockClaimedEvent) => void) {/* ... */}
  onLockRefunded(callback: (event: LockRefundedEvent) => void) {/* ... */}
}
```

- [ ] Implement blockchain services
- [ ] Add contract ABIs and addresses in `lib/config.ts`
- [ ] Set up event monitoring and WebSocket notifications

## Day 2: Frontend & Integration

### Morning: UI Components (3-4 hours)
```typescript
// components/SwapInterface.tsx
export function SwapInterface() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  
  return (
    <div className="space-y-6">
      <CreateOrderForm />
      <OrderList orders={orders} onSelect={setActiveOrder} />
      {activeOrder && <SwapProgress order={activeOrder} />}
    </div>
  );
}

// components/CreateOrderForm.tsx
export function CreateOrderForm() {
  const [makerChain, setMakerChain] = useState<'EVM' | 'SUI'>('EVM');
  const [takerChain, setTakerChain] = useState<'EVM' | 'SUI'>('SUI');
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <select value={makerChain} onChange={(e) => {
            setMakerChain(e.target.value as 'EVM' | 'SUI');
            setTakerChain(e.target.value === 'EVM' ? 'SUI' : 'EVM');
          }}>
            <option value="EVM">ETH</option>
            <option value="SUI">SUI</option>
          </select>
          <input type="text" placeholder="Amount to send" />
        </div>
        <span>→</span>
        <div>
          <select value={takerChain} disabled>
            <option value="SUI">SUI</option>
            <option value="EVM">ETH</option>
          </select>
          <input type="text" placeholder="Amount to receive" />
        </div>
      </div>
      <button onClick={handleCreateOrder}>Create Order</button>
    </div>
  );
}

// components/SwapProgress.tsx
export function SwapProgress({ order }: { order: Order }) {
  const steps = [
    {
      title: 'Order Created',
      status: order.status !== 'CREATED' ? 'complete' : 'current',
    },
    {
      title: 'Order Accepted',
      status: order.status === 'CREATED' ? 'upcoming' 
        : order.status !== 'ACCEPTED' ? 'complete' : 'current',
    },
    {
      title: `${order.makerChain} Funds Locked`,
      status: order.status === 'CREATED' || order.status === 'ACCEPTED' ? 'upcoming'
        : order.status !== 'MAKER_LOCKED' ? 'complete' : 'current',
    },
    {
      title: `${order.takerChain} Funds Locked`,
      status: ['CREATED', 'ACCEPTED', 'MAKER_LOCKED'].includes(order.status) ? 'upcoming'
        : order.status !== 'TAKER_LOCKED' ? 'complete' : 'current',
    },
    {
      title: 'Swap Completed',
      status: order.status === 'COMPLETED' ? 'complete' : 'upcoming',
    },
  ];
  
  return (/* ... */);
}
```

Components to create:
- [ ] `components/WalletConnector.tsx` (MetaMask + Sui Wallet)
- [ ] `components/CreateOrderForm.tsx` (with amount inputs and validation)
- [ ] `components/OrderList.tsx` (filterable by status)
- [ ] `components/SwapProgress.tsx` (with step-by-step progress)
- [ ] `components/common/Button.tsx`
- [ ] `components/common/Input.tsx`

### Afternoon: Integration & Testing (4-5 hours)
- [ ] Implement complete swap flow:
  1. Maker creates order (generates secret + hash)
  2. Taker accepts order
  3. Maker locks ETH (48h timelock)
  4. Taker locks SUI (24h timelock)
  5. Maker claims SUI (reveals secret)
  6. Taker claims ETH (using revealed secret)
- [ ] Add real-time updates via WebSocket
- [ ] Implement error handling and timelock monitoring
- [ ] Test complete flow on testnets

## Project Structure
```
relayer-service/
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   └── Input.tsx
│   ├── WalletConnector.tsx
│   ├── CreateOrderForm.tsx
│   ├── OrderList.tsx
│   └── SwapProgress.tsx
├── lib/
│   ├── blockchain/
│   │   ├── common.ts
│   │   ├── evm.ts
│   │   └── sui.ts
│   ├── store.ts
│   ├── config.ts
│   └── websocket.ts
├── pages/
│   ├── api/
│   │   └── orders/
│   │       ├── index.ts
│   │       ├── [id].ts
│   │       └── [id]/accept.ts
│   └── index.tsx
└── types/
    └── order.ts
```

## Tech Stack
- Next.js 13+ (Frontend + API Routes)
- TailwindCSS (Styling)
- ethers.js (EVM interaction)
- Sui SDK (Sui interaction)
- next-websocket (Real-time updates)

## Testing Plan
1. Test order creation/listing for both directions:
   - EVM → SUI
   - SUI → EVM
2. Test secret generation and hashing
3. Test lock creation and monitoring for both chains
4. Test claim flow in both directions
5. Test refund scenarios
6. Test WebSocket notifications
7. Verify timelocks (48h maker, 24h taker)

## Demo Script
1. Connect both wallets (MetaMask + Sui)
2. Demo EVM → SUI flow:
   - Create order (ETH → SUI)
   - Complete swap
3. Demo SUI → EVM flow:
   - Create order (SUI → ETH)
   - Complete swap
4. Show error handling:
   - Timelock expiry
   - Failed transactions
   - Network issues

## Security Considerations
- Verify timelock durations (48h for initiator, 24h for counterparty)
- Validate all transaction parameters
- Monitor for failed transactions
- Handle network errors gracefully
- Verify secret hashing matches both contracts
- Check regulated asset restrictions (especially for Sui)

## Deployment
- Deploy to Vercel
- Use environment variables for:
  - Contract addresses
  - Network RPC endpoints
  - WebSocket configuration
- Enable WebSocket support in Vercel

## Post-Hackathon Improvements
- Add proper database (e.g., Prisma + PostgreSQL)
- Improve error handling and recovery
- Add transaction monitoring and retries
- Support more assets (especially Sui Coin types)
- Add order expiry and cleanup
- Implement proper security measures
- Add dispute resolution mechanism 