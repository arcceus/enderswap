module htlc::htlc {
    use std::hash;

    use sui::coin::Coin;
    use sui::clock::{Self, Clock};

    use sui::event;

    const ESecretPreimageWrong: u64 = 1;
    const ESecretLengthWrong: u64 = 2;
    const ERefund3rdParty: u64 = 3;
    const ERefundEarly: u64 = 4;

    #[allow(lint(coin_field))] 
    public struct LockObject<phantom T> has key { // should not have `store` to pin it to the addressant
        id: UID,
        /// timestamp of the instance creation
        created_at: u64,
        /// timestamp after which `refund` is available
        deadline: u64,
        /// hashed value of the secret
        hashed: vector<u8>,
        /// refunded `Coin` will be addressed to this
        refund_adr: address,
        /// redeemed `Coin` will be addressed to this
        target_adr: address,
        /// address that initiated the lock
        initiator: address,
        /// byte length of the secret
        secret_length: u8,
        /// locked `Coin` 
        coin: Coin<T>,
        // hash: string::String // could be cool to have different hash variants, but it's always SHA-2 SHA256 in all implementations around
    }

    public struct NewLockEvent has copy, drop {
        /// `UID` of the lock created
        lock: ID,
        /// hash guarding the lock
        hash: vector<u8>,
        /// `Coin` that was locked
        coin: ID,
        /// refund address
        refund_adr: address,
        /// redeem address
        target_adr: address,
        /// address that created the lock
        initiator: address,
        /// timestamp after which `refund` is available
        deadline: u64,
        /// duration used to lock the `Coin`
        duration: u64,
        /// byte length of the secret
        secret_length: u8,
    }
    public struct LockClaimedEvent has copy, drop {
        /// `UID` of the lock redeemed
        lock: ID,
        /// unlock secret
        secret: vector<u8>,
        /// address initiated the claim
        claimer: address
    }
    public struct LockRefundedEvent has copy, drop {
        /// `UID` of the lock refunded
        lock: ID,
        /// address initiated the refund
        signer_: address,
    }

    /// Creates a new hash time lock.
    /// Doesn't `assert` hash length since it should be done by the counterparty anyway.
    public fun createLock<T>(
        clock: &Clock,
        durationMillis: u64,
        hashedSecret: vector<u8>, targetAddress: address, refund: address, amount: Coin<T>,
        secret_length: u8,
        ctx: &mut TxContext
    ) {
        let timestamp = clock::timestamp_ms(clock);
        let lock = LockObject{
            id: object::new(ctx),
            created_at: timestamp, 
            deadline: timestamp + durationMillis,
            hashed: hashedSecret, 
            refund_adr: refund,
            target_adr: targetAddress,
            initiator: ctx.sender(),
            coin: amount,
            secret_length
        };
        
        event::emit(NewLockEvent{
            lock: sui::object::id(&lock),
            hash: lock.hashed,
            coin: sui::object::id(&lock.coin),
            refund_adr: refund,
            target_adr: targetAddress,
            initiator: lock.initiator,
            deadline: lock.deadline,
            duration: durationMillis,
            secret_length
        });
        transfer::share_object(lock);
    }
    /// `create_lock_object` which defaults to 48 hours
    public fun createLock_48<T>(
        clock: &Clock,
        hashedSecret: vector<u8>, targetAddress: address, refund: address, amount: Coin<T>,
        secret_length: u8,
        ctx: &mut TxContext
    ) {
        createLock(
            clock, 
            172800000,
            hashedSecret, targetAddress, refund, amount, secret_length, ctx
        );
    }
    /// `create_lock_object` which defaults to 24 hours; useful for answering to another lock
    public fun createLock_24<T>(
        clock: &Clock,
        hashedSecret: vector<u8>, targetAddress: address, refund: address, amount: Coin<T>,
        secret_length: u8,
        ctx: &mut TxContext
    ) {
        createLock(
            clock, 
            86400000,
            hashedSecret, targetAddress, refund, amount, secret_length, ctx
        );
    }

    /// Redeems the lock. Requires only knowledge of the secret (not restricted to a calling address).
    public fun redeem<T>(lock: LockObject<T>, revealedSecret: vector<u8>, ctx: &mut TxContext) {
        assert!(lock.secret_length as u64 == revealedSecret.length(), ESecretLengthWrong); 
        assert!(&hash::sha2_256(revealedSecret) == &lock.hashed, ESecretPreimageWrong);
        
        event::emit(LockClaimedEvent{
            lock: sui::object::id(&lock),
            secret: revealedSecret,
            claimer: ctx.sender()
        });
        let LockObject{id, coin, target_adr, ..} = lock;
        transfer::public_transfer(coin, target_adr);
        object::delete(id);
    }

    /// Refunds the lock. Only addresses which the lock is aware of can call this.
    public fun refund<T>(lock: LockObject<T>, clock: &Clock, ctx: &mut TxContext) {
        assert!(
            &ctx.sender() == &lock.refund_adr
                || &ctx.sender() == &lock.initiator
                || &ctx.sender() == &lock.target_adr,
            ERefund3rdParty
        );
        assert!(clock.timestamp_ms() > lock.deadline, ERefundEarly);

        event::emit(LockRefundedEvent{
            lock: sui::object::id(&lock),
            signer_: ctx.sender()
        });
        let LockObject{id, coin, refund_adr, ..} = lock;
        transfer::public_transfer(coin, refund_adr);
        object::delete(id);
    }
}