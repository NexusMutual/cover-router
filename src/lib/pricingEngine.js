const { BigNumber } = require('ethers');

const { HTTP_STATUS } = require('./constants');
const { ApiError } = require('./error');
const { calculateProductDataForTranche } = require('./helpers');
const { selectProductPools, selectProduct } = require('../store/selectors');

/**
 * @typedef {import('../store/reducer').Store} Store
 */

/**
 * @typedef {Object} PoolPrice
 * @property {number} poolId
 * @property {BigNumber} targetPrice
 */

/**
 * @typedef {Object} PricingResult
 * @property {number} productId
 * @property {PoolPrice[]} pricePerPool
 * @property {BigNumber} weightedAveragePrice
 */

/**
 * Calculates the pricing information for a given product based on its associated pools,
 * weighted by each pool's available capacity.
 *
 * @param {Store} store
 * @param {number|string} productId
 * @returns {PricingResult}
 * @throws {ApiError} When the product or its pools are missing (`NOT_FOUND`).
 */
function pricingEngine(store, productId) {
  const { assets, assetRates } = store.getState();
  const product = selectProduct(store, productId);
  const productPools = selectProductPools(store, productId);
  const now = Math.floor(Date.now() / 1000);

  if (!product || !productPools.length) {
    throw new ApiError('Product not found', HTTP_STATUS.NOT_FOUND);
  }

  const pricePerPool = [];
  let totalWeight = BigNumber.from(0);
  let weightedSum = BigNumber.from(0);

  // Get capacity data per pool
  const { capacityPerPool } = calculateProductDataForTranche(
    productPools,
    0, // use trancheIndex 0 to include all active tranches in pool capacity calculation
    product.useFixedPrice,
    now,
    assets,
    assetRates,
  );

  productPools.forEach((pool, index) => {
    // Find NXM capacity and use only available capacity as weight
    const availableCapacityNXM =
      capacityPerPool[index].availableCapacity.find(c => c.assetId === 255)?.amount || BigNumber.from(0);

    // Skip pools with 0 available capacity
    if (availableCapacityNXM.isZero()) {
      return;
    }

    pricePerPool.push({
      poolId: pool.poolId,
      targetPrice: pool.targetPrice,
    });

    // Update running totals using only the available capacity as weight
    totalWeight = totalWeight.add(availableCapacityNXM);
    weightedSum = weightedSum.add(pool.targetPrice.mul(availableCapacityNXM));
  });

  // Calculate weighted average price, handling division with BigNumber precision
  const weightedAveragePrice = totalWeight.isZero() ? BigNumber.from(0) : weightedSum.div(totalWeight);

  return {
    productId: Number(productId),
    pricePerPool,
    weightedAveragePrice,
  };
}

module.exports = { pricingEngine };
