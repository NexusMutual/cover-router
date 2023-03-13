const { ethers } = require('ethers');

const { selectProductPools } = require('../store/selectors');
const { NXM_PER_ALLOCATION_UNIT } = require('./constants');

const { WeiPerEther, Zero } = ethers.constants;

function capacityEngine(store, productId, firstUsableTrancheIndex) {
  const { assets, assetRates } = store.getState();
  const productPools = selectProductPools(store, productId);

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

  const capacity = { productId };

  for (const [symbol, assetId] of Object.entries(assets)) {
    // TODO: use asset decimals instead of generic 18 decimals
    capacity[`capacity${symbol}`] = capacityNXM.mul(WeiPerEther).div(assetRates[assetId]).toString();
  }
  return capacity;
}

module.exports = capacityEngine;
