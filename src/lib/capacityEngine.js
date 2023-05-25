const { ethers } = require('ethers');

const { selectProductPools, selectProduct } = require('../store/selectors');
const { NXM_PER_ALLOCATION_UNIT, MIN_COVER_PERIOD } = require('./constants');
const { bnMax, calculateTrancheId } = require('./helpers');

const { WeiPerEther, Zero } = ethers.constants;

function capacityEngine(store, productIds, time) {
  const { assets, assetRates } = store.getState();
  const capacities = [];
  const ids = productIds.length === 0 ? Object.keys(store.getState().products) : [...productIds];

  for (const productId of ids) {
    const product = selectProduct(store, productId);

    if (!product) {
      continue;
    }

    const productPools = selectProductPools(store, productId);
    const productCapacity = { productId: Number(productId), capacity: [], capacityUsed: Zero };

    const firstActiveTrancheId = calculateTrancheId(time);
    const gracePeriodExpiration = time.add(MIN_COVER_PERIOD).add(product.gracePeriod);
    const firstUsableTrancheId = calculateTrancheId(gracePeriodExpiration);
    const firstUsableTrancheIndex = firstUsableTrancheId - firstActiveTrancheId;

    const { capacityAvailableNXM, capacityUsedNXM } = productPools.reduce(
      ({ capacityAvailableNXM, capacityUsedNXM }, pool) => {
        const { allocations, trancheCapacities } = pool;

        // sum up all allocations to get used capacity
        const used = allocations.reduce((total, allocation) => total.add(allocation), Zero);

        // traverse all tranches and sum up available capacity on a per-tranche basis
        const available = trancheCapacities
          .slice(firstUsableTrancheIndex) // skip unusable
          .reduce((total, capacity, index) => {
            // allocations may surpass total capacity in some scenarios
            const free = bnMax(capacity.sub(allocations[index]), Zero);
            return total.add(free);
          }, Zero);

        return {
          capacityUsedNXM: used.mul(NXM_PER_ALLOCATION_UNIT).add(capacityUsedNXM),
          capacityAvailableNXM: available.mul(NXM_PER_ALLOCATION_UNIT).add(capacityAvailableNXM),
        };
      },
      { capacityAvailableNXM: Zero, capacityUsedNXM: Zero },
    );

    for (const assetId of Object.values(assets)) {
      productCapacity.capacity.push({
        assetId,
        // TODO: use asset decimals instead of generic 18 decimals
        amount: capacityAvailableNXM.mul(assetRates[assetId]).div(WeiPerEther),
      });
    }

    productCapacity.capacityUsed = capacityUsedNXM;
    capacities.push(productCapacity);
  }

  return capacities;
}

module.exports = capacityEngine;
