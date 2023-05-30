const EventEmitter = require('events');
const { ethers } = require('ethers');
const { calculateTrancheId, calculateBucketId } = require('./helpers');

const topics = [
  [
    'StakeBurned(uint)',
    'DepositExtended(address,uint256,uint256,uint256,uint256)',
    'StakeDeposited(address,uint256,uint256,uint256)',
    'PoolFeeChanged(address,uint)',
    'Deallocated(uint)',
  ].map(event => ethers.utils.id(event)),
];

module.exports = async (provider, contracts) => {
  // event emitter
  const emitter = new EventEmitter();

  // contract instances
  const stakingPoolFactory = contracts('StakingPoolFactory');
  const cover = contracts('Cover');
  const stakingProducts = contracts('StakingProducts');

  // tranche id checker
  let currentTrancheId = calculateTrancheId(Math.floor(Date.now() / 1000));
  let currentBucketId = calculateBucketId(Math.floor(Date.now() / 1000));

  // emit an event on every block
  provider.on('block', async blockNumber => {
    const activeBucketId = calculateBucketId(Math.floor(Date.now() / 1000));
    const activeTrancheId = calculateTrancheId(Math.floor(Date.now() / 1000));

    if (activeBucketId !== currentBucketId) {
      const { timestamp: blockTimestamp } = await provider.getBlock(blockNumber);
      const blockBucketId = calculateBucketId(blockTimestamp);

      if (blockBucketId === activeBucketId) {
        console.log(`Event: Bucket ${currentBucketId} expired`);

        currentBucketId = activeBucketId;
        emitter.emit('bucket:change');
      }
    }

    if (activeTrancheId !== currentTrancheId) {
      const { timestamp: blockTimestamp } = await provider.getBlock(blockNumber);
      const blockTrancheId = calculateTrancheId(blockTimestamp);

      if (blockTrancheId === activeTrancheId) {
        console.log(`Event: Tranche ${currentTrancheId} expired`);

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
    stakingPool.on({ topics }, () => {
      console.log(`Event: Pool ${poolId} state change`);
      emitter.emit('pool:change', poolId);
    });
  }

  // subscribe to events on new staking pool
  stakingPoolFactory.on('StakingPoolCreated', async poolId => {
    console.log(`Event: Pool ${poolId} created`);
    emitter.emit('pool:change', poolId);
    const stakingPool = contracts('StakingPool', poolId);
    stakingPool.on({ topics }, () => {
      console.log(`Event: Pool ${poolId} update`);
      emitter.emit('pool:change', poolId);
    });
  });

  stakingProducts.on('ProductUpdated', productId => {
    console.log(`Event: Product ${productId} update`);
    emitter.emit('product:change', productId);
  });
  cover.on('ProductSet', productId => {
    console.log(`Event: Product ${productId} set`);
    emitter.emit('product:change', productId);
  });
  cover.on('CoverEdited', (coverId, productId) => {
    console.log(`Event: Cover ${coverId} for product ${productId} edited`);
    emitter.emit('product:change', productId);
  });

  return {
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    once: emitter.once.bind(emitter),
  };
};
