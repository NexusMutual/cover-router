const { ethers, BigNumber } = require('ethers');

const { selectProductPools, selectProduct } = require('../store/selectors');
const { NXM_PER_ALLOCATION_UNIT, MIN_COVER_PERIOD } = require('./constants');
const { calculateTrancheId } = require('./helpers');

const { WeiPerEther, Zero } = ethers.constants;

function calculateCapacity(store, productId, time) {
  const { assets, assetRates } = store.getState();
  const productPools = selectProductPools(store, productId);
  const { gracePeriod } = selectProduct(store, productId);

  const firstActiveTrancheId = calculateTrancheId(time);
  const gracePeriodExpiration = time.add(MIN_COVER_PERIOD).add(gracePeriod);
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

  const capacity = { productId };

  for (const [symbol, assetId] of Object.entries(assets)) {
    // TODO: use asset decimals instead of generic 18 decimals
    capacity[`capacity${symbol}`] = capacityNXM.mul(WeiPerEther).div(assetRates[assetId]);
  }
  return capacity;
}

module.exports = (store, productIds = [], time = BigNumber.from(Date.now()).div(1000)) => {
  if (productIds.length === 0) {
    const { products } = store.getState();
    return Object.keys(products).map(productId => calculateCapacity(store, productId, time));
  }
  const [productId] = productIds;
  return calculateCapacity(store, productId, time);
};
