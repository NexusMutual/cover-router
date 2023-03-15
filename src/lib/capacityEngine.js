const { ethers } = require('ethers');

const { selectProductPools, selectProduct } = require('../store/selectors');
const { NXM_PER_ALLOCATION_UNIT, MIN_COVER_PERIOD } = require('./constants');
const { calculateTrancheId } = require('./helpers');

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
    const productCapacity = { productId, capacity: [] };

    const firstActiveTrancheId = calculateTrancheId(time);
    const gracePeriodExpiration = time.add(MIN_COVER_PERIOD).add(product.gracePeriod);
    const firstUsableTrancheId = calculateTrancheId(gracePeriodExpiration);
    const firstUsableTrancheIndex = firstUsableTrancheId - firstActiveTrancheId;

    const capacityNXM = productPools.reduce((capacity, pool) => {
      const { allocations, trancheCapacities } = pool;

      const totalCapacity = trancheCapacities
        .slice(firstUsableTrancheIndex)
        .reduce((total, capacity) => total.add(capacity), Zero)
        .mul(NXM_PER_ALLOCATION_UNIT);

      const initiallyUsedCapacity = allocations
        .slice(firstUsableTrancheIndex)
        .reduce((total, allocation) => total.add(allocation), Zero)
        .mul(NXM_PER_ALLOCATION_UNIT);

      if (totalCapacity.gt(initiallyUsedCapacity)) {
        return capacity.add(totalCapacity).sub(initiallyUsedCapacity);
      }
      return capacity;
    }, Zero);

    for (const assetId of Object.values(assets)) {
      productCapacity.capacity.push({
        assetId,
        // TODO: use asset decimals instead of generic 18 decimals
        amount: capacityNXM.mul(assetRates[assetId]).div(WeiPerEther),
      });
    }
    capacities.push(productCapacity);
  }

  return capacities;
}

module.exports = capacityEngine;
