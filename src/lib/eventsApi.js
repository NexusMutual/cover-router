const EventEmitter = require('events');

const { BigNumber } = require('ethers');

const { calculateTrancheId, calculateBucketId } = require('./helpers');

const events = ['StakeBurned', 'DepositExtended', 'StakeDeposited', 'PoolFeeChanged', 'Deallocated'];

/**
 * @typedef {import('ethers').providers.Provider} Provider
 */

/**
 * Event names emitted by the events API and the argument types the synchronizer
 * receives in each listener:
 *
 * | Event                  | Args                                             |
 * |------------------------|--------------------------------------------------|
 * | `pool:change`          | `(poolId: number)`                               |
 * | `product:change`       | `(productId: BigNumber)`                         |
 * | `cover:bought`         | `(coverId: number)`                               |
 * | `cover:edit`           | `(originalCoverId: number)`                      |
 * | `cover:change`         | `(coverId: number)`                               |
 * | `block`                | `(blockNumber: number, blockTimestamp: number)`   |
 * | `tranche:change`       | (none)                                           |
 * | `bucket:change`        | (none)                                           |
 * | `ri:bought`            | `(coverId: number, data: string, dataFormat: number)` |
 * | `ri:withdraw`          | `(vaultId: string)`                              |
 * | `ri:deposit`           | `(vaultId: string)`                              |
 * | `ri:slash`             | `(vaultId: string)`                              |
 * | `ri:setMaxNetworkLimit`| `(vaultId: string)`                              |
 * | `ri:setNetworkLimit`   | `(vaultId: string)`                              |
 *
 * @typedef {Object} EventsApi
 * @property {Function} on
 * @property {Function} off
 * @property {Function} once
 */

/**
 * Subscribes to on-chain events and new blocks, emitting normalized
 * updates on a shared EventEmitter.
 *
 * @param {Provider} provider
 * @param {Function} contracts - Contract factory `(name, id?) => ethers.Contract`.
 * @param {Object} riContracts - RI/Symbiotic contract instances keyed by `vault_*`, `delegator_*`.
 * @returns {Promise<EventsApi>}
 */
module.exports = async (provider, contracts, riContracts) => {
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
    const { timestamp: blockTimestamp } = await provider.getBlock(blockNumber);
    const now = Math.floor(Date.now() / 1000);
    const activeBucketId = calculateBucketId(now);
    const activeTrancheId = calculateTrancheId(now);

    if (activeBucketId !== currentBucketId) {
      const blockBucketId = calculateBucketId(blockTimestamp);

      if (blockBucketId === activeBucketId) {
        console.info(`Event: Bucket ${currentBucketId} expired`);

        currentBucketId = activeBucketId;
        emitter.emit('bucket:change');
      }
    }

    if (activeTrancheId !== currentTrancheId) {
      const blockTrancheId = calculateTrancheId(blockTimestamp);

      if (blockTrancheId === activeTrancheId) {
        console.info(`Event: Tranche ${currentTrancheId} expired`);

        currentTrancheId = activeTrancheId;
        emitter.emit('tranche:change');
      }
    }

    emitter.emit('block', blockNumber, blockTimestamp);
  });

  // listeners
  const stakingPoolCount = (await stakingPoolFactory.stakingPoolCount()).toNumber();

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
    const coverIdNum = coverId.toNumber();
    const originalCoverIdNum = originalCoverId.toNumber();
    console.info(`Event: Cover ${coverIdNum} for product ${productId} bought`);
    emitter.emit('product:change', productId);
    emitter.emit('cover:bought', coverIdNum);
    if (coverIdNum !== originalCoverIdNum) {
      emitter.emit('cover:edit', originalCoverIdNum);
    }
  });
  claims.on('ClaimPayoutRedeemed', (user, amount, claimId, coverId) => {
    const coverIdNum = coverId.toNumber();
    console.info(`Event: Claim payout redeemed for cover id ${coverIdNum}`);
    emitter.emit('cover:change', coverIdNum);
  });

  // Cover Ri events
  cover.on('CoverRiAllocated', (coverId, premium, paymentAsset, data, dataFormat) => {
    const coverIdNum = coverId.toNumber();
    console.info(`Event: Cover ${coverIdNum} allocated with RI`);
    emitter.emit('ri:bought', coverIdNum, data, dataFormat);
  });

  for (const contractName of Object.keys(riContracts)) {
    const vaultId = contractName.split('_')[1];
    if (contractName.startsWith('vault_')) {
      riContracts[contractName].on('Withdraw', () => {
        console.info(`Event: Withdraw for vault ${vaultId}`);
        emitter.emit('ri:withdraw', vaultId);
      });
      riContracts[`vault_${vaultId}`].on('Deposit', () => {
        console.info(`Event: Deposit for vault ${vaultId}`);
        emitter.emit('ri:deposit', vaultId);
      });
      riContracts[`vault_${vaultId}`].on('OnSlash', () => {
        console.info(`Event: Slash for vault ${vaultId}`);
        emitter.emit('ri:slash', vaultId);
      });
    }
    if (contractName.startsWith('delegator_')) {
      riContracts[`delegator_${vaultId}`].on('SetMaxNetworkLimit', () => {
        console.info(`Event: SetMaxNetworkLimit for vault ${vaultId}`);
        emitter.emit('ri:setMaxNetworkLimit', vaultId);
      });
      riContracts[`delegator_${vaultId}`].on('SetNetworkLimit', () => {
        console.info(`Event: SetNetworkLimit for vault ${vaultId}`);
        emitter.emit('ri:setNetworkLimit', vaultId);
      });
    }
  }

  return {
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    once: emitter.once.bind(emitter),
  };
};
