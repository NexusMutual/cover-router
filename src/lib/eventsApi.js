const EventEmitter = require('events');

const { BigNumber } = require('ethers');

const { calculateTrancheId, calculateBucketId } = require('./helpers');

const events = ['StakeBurned', 'DepositExtended', 'StakeDeposited', 'PoolFeeChanged', 'Deallocated'];

module.exports = async (provider, contracts) => {
  // event emitter
  const emitter = new EventEmitter();

  // contract instances
  const stakingPoolFactory = contracts('StakingPoolFactory');
  const cover = contracts('Cover');
  const coverProducts = contracts('CoverProducts');
  const stakingProducts = contracts('StakingProducts');
  const claims = contracts('Claims');

  // tranche id checker
  const now = Math.floor(Date.now() / 1000);
  let currentTrancheId = calculateTrancheId(now);
  let currentBucketId = calculateBucketId(now);

  // emit an event on every block
  provider.on('block', async blockNumber => {
    const now = Math.floor(Date.now() / 1000);
    const activeBucketId = calculateBucketId(now);
    const activeTrancheId = calculateTrancheId(now);

    if (activeBucketId !== currentBucketId) {
      const { timestamp: blockTimestamp } = await provider.getBlock(blockNumber);
      const blockBucketId = calculateBucketId(blockTimestamp);

      if (blockBucketId === activeBucketId) {
        console.info(`Event: Bucket ${currentBucketId} expired`);

        currentBucketId = activeBucketId;
        emitter.emit('bucket:change');
      }
    }

    if (activeTrancheId !== currentTrancheId) {
      const { timestamp: blockTimestamp } = await provider.getBlock(blockNumber);
      const blockTrancheId = calculateTrancheId(blockTimestamp);

      if (blockTrancheId === activeTrancheId) {
        console.info(`Event: Tranche ${currentTrancheId} expired`);

        currentTrancheId = activeTrancheId;
        emitter.emit('tranche:change');
      }
    }

    emitter.emit('block', blockNumber);
  });

  // listeners
  const stakingPoolCount = await stakingPoolFactory.stakingPoolCount();

  // subscribe to events for currently existing pools
  for (let poolId = 1; poolId <= stakingPoolCount; poolId++) {
    const stakingPool = contracts('StakingPool', poolId);
    for (const eventName of events) {
      stakingPool.on(eventName, () => {
        console.info(`Event: ${eventName} triggered for Pool ${poolId}`);
        emitter.emit('pool:change', poolId);
      });
    }
  }

  // subscribe to events on new staking pool
  stakingPoolFactory.on('StakingPoolCreated', async poolId => {
    const poolIdParsed = BigNumber.isBigNumber(poolId) ? poolId.toNumber() : poolId;
    console.info(`Event: Pool ${poolIdParsed} created`);
    emitter.emit('pool:change', poolIdParsed);
    const stakingPool = contracts('StakingPool', poolIdParsed);
    for (const eventName of events) {
      stakingPool.on(eventName, () => {
        console.info(`Event: ${eventName} triggered for Pool ${poolIdParsed}`);
        emitter.emit('pool:change', poolIdParsed);
      });
    }
  });

  stakingProducts.on('ProductUpdated', productId => {
    console.info(`Event: Product ${productId} update`);
    emitter.emit('product:change', productId);
  });
  coverProducts.on('ProductSet', productId => {
    console.info(`Event: Product ${productId} set`);
    emitter.emit('product:change', productId);
  });
  cover.on('CoverBought', (coverId, originalCoverId, memberId, productId) => {
    console.info(`Event: Cover ${coverId} for product ${productId} bought`);
    emitter.emit('product:change', productId);
    emitter.emit('cover:bought', coverId);
    if (coverId !== originalCoverId) {
      emitter.emit('cover:edit', originalCoverId);
    }
  });
  claims.on('ClaimPayoutRedeemed', (user, amount, claimId, coverId) => {
    console.info(`Event: Claim payout redeemed for cover id ${coverId}`);
    emitter.emit('cover:change', coverId);
  });

  return {
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    once: emitter.once.bind(emitter),
  };
};
