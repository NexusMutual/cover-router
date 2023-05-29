const EventEmitter = require('events');
const { ethers } = require('ethers');
const { calculateTrancheId, calculateBucketId } = require('./helpers');

const topics = [
  [
    'StakeBurned(uint)',
    'DepositExtended(address,uint256,uint256,uint256,uint256)',
    'StakeDeposited(address,uint256,uint256,uint256)',
    'PoolFeeChanged(address,uint)',
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
  provider.on('block', blockNumber => {
    const activeBucketId = calculateBucketId(Math.floor(Date.now() / 1000));
    const activeTrancheId = calculateTrancheId(Math.floor(Date.now() / 1000));
    if (activeBucketId !== currentBucketId) {
      currentBucketId = activeBucketId;
      emitter.emit('bucket:change');
    }
    if (activeTrancheId !== currentTrancheId) {
      currentTrancheId = activeTrancheId;
      emitter.emit('tranche:change');
    }
    emitter.emit('block', blockNumber);
  });

  // listeners
  const stakingPoolCount = await stakingPoolFactory.stakingPoolCount();

  // subscribe to events for currently existing pools
  for (let poolId = 1; poolId <= stakingPoolCount; poolId++) {
    const stakingPool = contracts('StakingPool', poolId);
    stakingPool.on({ topics }, () => emitter.emit('pool:change', poolId));
  }

  // subscribe to events on new staking pool
  stakingPoolFactory.on('StakingPoolCreated', async poolId => {
    emitter.emit('pool:change', poolId);
    const stakingPool = contracts('StakingPool', poolId);
    stakingPool.on({ topics }, () => emitter.emit('pool:change', poolId));
  });

  stakingProducts.on('ProductUpdated', productId => emitter.emit('product:change', productId));
  cover.on('ProductSet', productId => emitter.emit('product:change', productId));
  cover.on('CoverEdited', (coverId, productId) => emitter.emit('product:change', productId));

  return {
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    once: emitter.once.bind(emitter),
  };
};
