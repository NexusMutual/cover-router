const EventEmitter = require('events');
const { ethers } = require('ethers');
const { calculateTrancheId } = require('./helpers');

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

  // emit an event on every block
  provider.on('block', blockNumber => emitter.emit('block', blockNumber));

  // contract instances
  const stakingPoolFactory = contracts('StakingPoolFactory');
  const cover = contracts('Cover');

  // tranche id checker
  let currentTrancheId = calculateTrancheId(Math.floor(Date.now() / 1000));

  setInterval(() => {
    const activeTrancheId = calculateTrancheId(Math.floor(Date.now() / 1000));
    if (activeTrancheId !== currentTrancheId) {
      currentTrancheId = activeTrancheId;
      emitter.emit('tranche:change');
    }
  }, 1000);

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

  cover.on('ProductSet', productId => emitter.emit('product:change', productId));
  cover.on('CoverEdited', (coverId, productId) => emitter.emit('product:change', productId));

  return {
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    once: emitter.once.bind(emitter),
  };
};
