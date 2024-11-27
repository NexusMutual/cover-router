const { ethers, BigNumber } = require('ethers');

const { MAX_COVER_PERIOD, SECONDS_PER_DAY } = require('./constants');
const {
  bnMax,
  calculateTrancheId,
  calculateFirstUsableTrancheIndex,
  calculateProductDataForTranche,
} = require('./helpers');
const { selectProduct, selectProductPools } = require('../store/selectors');

const { WeiPerEther, Zero } = ethers.constants;

const BASIS_POINTS = 10000;

/**
 * Calculates the utilization rate of the capacity.
 *
 * @param {BigNumber} capacityAvailableNXM - The amount of capacity available in NXM.
 * @param {BigNumber} capacityUsedNXM - The amount of capacity used in NXM.
 * @returns {BigNumber} The utilization rate as a BigNumber, expressed in basis points (0-10,000).
 *                      Returns undefined if capacity in NXM is missing.
 */
function getUtilizationRate(capacityAvailableNXM, capacityUsedNXM) {
  if (!capacityAvailableNXM || !capacityUsedNXM) {
    return undefined;
  }

  const totalCapacity = capacityAvailableNXM.add(capacityUsedNXM);
  if (totalCapacity.isZero()) {
    return BigNumber.from(0);
  }

  return capacityUsedNXM.mul(BASIS_POINTS).div(totalCapacity);
}

/**
 * Retrieves all product IDs that are associated with a specific pool.
 *
 * @param {Object} store - The Redux store containing application state.
 * @param {number|string} poolId - The ID of the pool to filter products by.
 * @returns {Array<string>} An array of product IDs associated with the specified pool.
 */
function getProductsInPool(store, poolId) {
  const { products } = store.getState();
  return Object.keys(products).filter(productId => {
    const productPools = selectProductPools(store, productId, poolId);
    return productPools?.length > 0;
  });
}

/**
 * Calculates the index of the first usable tranche for the maximum cover period.
 * This is used to determine the maximum price a user would get when buying cover.
 *
 * @param {BigNumber} now - The current timestamp in seconds.
 * @param {BigNumber} gracePeriod - The product's grace period in seconds.
 * @returns {number} The index difference between the first usable tranche for max period and the first active tranche.
 */
function calculateFirstUsableTrancheForMaxPeriodIndex(now, gracePeriod) {
  const firstActiveTrancheId = calculateTrancheId(now);
  const firstUsableTrancheForMaxPeriodId = calculateTrancheId(now.add(MAX_COVER_PERIOD).add(gracePeriod));
  return firstUsableTrancheForMaxPeriodId - firstActiveTrancheId;
}

/**
 * Calculates the pool-level utilization rate across all products in the pool.
 *
 * @param {Array<Object>} products - Array of product capacity data for the pool
 * @returns {BigNumber} The pool-level utilization rate as a BigNumber, expressed in basis points (0-10,000)
 */
function calculatePoolUtilizationRate(products) {
  let totalCapacityAvailableNXM = Zero;
  let totalCapacityUsedNXM = Zero;

  products.forEach(product => {
    totalCapacityAvailableNXM = totalCapacityAvailableNXM.add(
      product.availableCapacity.find(c => c.assetId === 255)?.amount || Zero,
    );
    totalCapacityUsedNXM = totalCapacityUsedNXM.add(product.usedCapacity);
  });

  return getUtilizationRate(totalCapacityAvailableNXM, totalCapacityUsedNXM);
}

/**
 * Helper function to calculate capacity for a single product.
 */
function calculateProductCapacity(
  store,
  productId,
  { poolId = null, periodSeconds, withPools = false, now, assets, assetRates },
) {
  const product = selectProduct(store, productId);
  if (!product) {
    return null;
  }

  const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(now, product.gracePeriod, periodSeconds);
  const firstUsableTrancheForMaxPeriodIndex = calculateFirstUsableTrancheForMaxPeriodIndex(now, product.gracePeriod);

  // Use productPools from poolId if available; otherwise, select all pools for productId
  const productPools = selectProductPools(store, productId, poolId);

  let aggregatedData = {};
  let capacityPerPool = [];
  let maxAnnualPrice = Zero;

  if (product.useFixedPrice) {
    // Fixed Price
    ({ aggregatedData, capacityPerPool } = calculateProductDataForTranche(
      productPools,
      firstUsableTrancheIndex,
      true,
      now,
      assets,
      assetRates,
    ));

    const { capacityAvailableNXM, totalPremium } = aggregatedData;
    maxAnnualPrice = capacityAvailableNXM.isZero() ? Zero : WeiPerEther.mul(totalPremium).div(capacityAvailableNXM);
  } else {
    // Non-fixed Price
    // use the first 6 tranches (over 1 year) for calculating the max annual price
    for (let i = 0; i <= firstUsableTrancheForMaxPeriodIndex; i++) {
      const { aggregatedData: trancheData, capacityPerPool: trancheCapacityPerPool } = calculateProductDataForTranche(
        productPools,
        i,
        false,
        now,
        assets,
        assetRates,
      );

      if (i === firstUsableTrancheIndex) {
        aggregatedData = trancheData;
        capacityPerPool = trancheCapacityPerPool;
      }

      const { capacityAvailableNXM, totalPremium } = trancheData;
      const maxTrancheAnnualPrice = capacityAvailableNXM.isZero()
        ? Zero
        : WeiPerEther.mul(totalPremium).div(capacityAvailableNXM);
      maxAnnualPrice = bnMax(maxAnnualPrice, maxTrancheAnnualPrice);
    }
  }

  const { capacityAvailableNXM, capacityUsedNXM, minPrice } = aggregatedData;
  // The available capacity of a product across all pools
  const capacityInAssets = Object.keys(assets).map(assetId => ({
    assetId: Number(assetId),
    amount: capacityAvailableNXM.mul(assetRates[assetId]).div(WeiPerEther),
    asset: assets[assetId],
  }));

  const capacityData = {
    productId: Number(productId),
    availableCapacity: capacityInAssets,
    usedCapacity: capacityUsedNXM,
    minAnnualPrice: minPrice,
    maxAnnualPrice,
  };

  if (withPools) {
    capacityData.capacityPerPool = capacityPerPool;
  }

  return capacityData;
}

/* API SERVICES */

/**
 * Gets capacity data for all products.
 * GET /capacity
 *
 * @param {Object} store - The Redux store containing application state.
 * @param {Object} [options={}] - Optional parameters.
 * @param {number} [options.periodSeconds=30*SECONDS_PER_DAY] - The coverage period in seconds.
 * @returns {Array<Object>} Array of product capacity data.
 */
function getAllProductCapacities(store, { periodSeconds = SECONDS_PER_DAY.mul(30) } = {}) {
  const { assets, assetRates, products } = store.getState();
  const now = BigNumber.from(Date.now()).div(1000);

  return Object.keys(products)
    .map(productId => calculateProductCapacity(store, productId, { periodSeconds, now, assets, assetRates }))
    .filter(Boolean); // remove any nulls (i.e. productId did not match any products)
}

/**
 * Gets capacity data for a single product across all pools.
 * GET /capacity/:productId
 *
 * @param {Object} store - The Redux store containing application state.
 * @param {string|number} productId - The product ID.
 * @param {Object} [options={}] - Optional parameters.
 * @param {number} [options.periodSeconds=30*SECONDS_PER_DAY] - The coverage period in seconds.
 * @param {boolean} [options.withPools=false] - Include per-pool capacity breakdown.
 * @returns {Object|null} Product capacity data or null if product not found.
 */
function getProductCapacity(store, productId, { periodSeconds = SECONDS_PER_DAY.mul(30), withPools = false } = {}) {
  const { assets, assetRates } = store.getState();
  const now = BigNumber.from(Date.now()).div(1000);

  return calculateProductCapacity(store, productId, {
    periodSeconds,
    withPools,
    now,
    assets,
    assetRates,
  });
}

}

module.exports = {
  getUtilizationRate,
  calculateFirstUsableTrancheForMaxPeriodIndex,
  getProductsInPool,
  capacityEngine,
};
