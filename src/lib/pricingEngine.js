const { BigNumber } = require('ethers');

const { calculateProductDataForTranche } = require('./helpers');
const { selectProductPools, selectProduct } = require('../store/selectors');

/**
 * Calculates the pricing information for a given product based on its associated pools,
 * weighted by each pool's available capacity.
 *
 * @param {Object} store - The application state store containing product data.
 * @param {number} productId - The unique identifier for the product to calculate pricing for.
 * @returns {Object|null} An object containing the product ID, an array of price per pool,
 *                       and the weighted average price, or null if no pools are found.
 */
function pricingEngine(store, productId) {
  const { assets, assetRates } = store.getState();
  const product = selectProduct(store, productId);
  const productPools = selectProductPools(store, productId);
  const now = BigNumber.from(Math.floor(Date.now() / 1000));

  if (!product || !productPools.length) {
    return null;
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

    // Skip pools with targetWeight/availableCapacityNXM = 0
    if (pool.targetWeight.isZero() && availableCapacityNXM.isZero()) {
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
