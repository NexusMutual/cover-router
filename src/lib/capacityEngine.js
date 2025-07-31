const { ethers, BigNumber } = require('ethers');

const { MAX_COVER_PERIOD } = require('./constants');
const {
  bnMax,
  calculateTrancheId,
  calculateFirstUsableTrancheIndex,
  calculateProductDataForTranche,
  getCapacitiesInAssets,
  getLatestCover,
} = require('./helpers');
const { selectProduct, selectProductPools, selectProductsInPool } = require('../store/selectors');

const { WeiPerEther, Zero } = ethers.constants;

const BASIS_POINTS = 10000;

/**
 * Calculates the index of the first usable tranche for the maximum cover period.
 * This is used to determine the maximum price a user would get when buying cover.
 *
 * @param {BigNumber} now - The current timestamp in seconds.
 * @param {BigNumber} gracePeriod - The product's grace period in seconds.
 * @returns {number} The index difference between the first usable tranche for max period and the first active tranche.
 */
function calculateFirstUsableTrancheIndexForMaxPeriod(now, gracePeriod) {
  const firstActiveTrancheId = calculateTrancheId(now);
  const firstUsableTrancheIdForMaxPeriod = calculateTrancheId(now.add(MAX_COVER_PERIOD).add(gracePeriod));
  return firstUsableTrancheIdForMaxPeriod - firstActiveTrancheId;
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

  const totalCapacity = totalCapacityAvailableNXM.add(totalCapacityUsedNXM);
  if (totalCapacity.isZero()) {
    return BigNumber.from(0);
  }

  return totalCapacityUsedNXM.mul(BASIS_POINTS).div(totalCapacity);
}

/**
 * Helper function to calculate capacity for a single product.
 */
function calculateProductCapacity(
  store,
  productId,
  { poolId = null, period, now, assets, assetRates, withPools = true, editedCover = null },
) {
  const product = selectProduct(store, productId);
  if (!product) {
    return null;
  }

  const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(now, product.gracePeriod, period);
  const firstUsableTrancheForMaxPeriodIndex = calculateFirstUsableTrancheIndexForMaxPeriod(now, product.gracePeriod);

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
      editedCover,
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
        editedCover,
      );

      if (i === firstUsableTrancheIndex) {
        // use the capacity data on the firstUsableTrancheIndex
        aggregatedData = trancheData;
        capacityPerPool = trancheCapacityPerPool;
      }

      // continue iterating through the tranches to calculate the max annual price
      const { capacityAvailableNXM, totalPremium } = trancheData;
      const maxTrancheAnnualPrice = capacityAvailableNXM.isZero()
        ? Zero
        : WeiPerEther.mul(totalPremium).div(capacityAvailableNXM);
      maxAnnualPrice = bnMax(maxAnnualPrice, maxTrancheAnnualPrice);
    }
  }

  const { capacityAvailableNXM, capacityUsedNXM, minPrice } = aggregatedData;

  // The available (i.e. remaining) capacity of a product
  const capacityInAssets = getCapacitiesInAssets(capacityAvailableNXM, assets, assetRates);

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
 * @param {number} period - The coverage period in seconds.
 * @returns {Array<Object>} Array of product capacity data.
 */
function getAllProductCapacities(store, period) {
  const { assets, assetRates, products } = store.getState();
  const now = BigNumber.from(Date.now()).div(1000);

  return Object.keys(products)
    .map(productId => calculateProductCapacity(store, productId, { period, now, assets, assetRates, withPools: false }))
    .filter(Boolean); // remove any nulls (i.e. productId did not match any products)
}

/**
 * Gets capacity data for a single product across all pools.
 * GET /capacity/:productId
 *
 * @param {Object} store - The Redux store containing application state.
 * @param {string|number} productId - The product ID.
 * @param {number} period - The coverage period in seconds.
 * @param {number} editedCoverId - The ID of the cover which is edited. ID is 0 when getting capacity for a new cover.
 * @returns {Object|null} Product capacity data or null if product not found.
 */
function getProductCapacity(store, productId, period, editedCoverId = 0) {
  const { assets, assetRates } = store.getState();
  const now = BigNumber.from(Date.now()).div(1000);

  const editedCover = getLatestCover(store, editedCoverId);

  return calculateProductCapacity(store, productId, {
    period,
    now,
    assets,
    assetRates,
    editedCover,
  });
}

/**
 * Gets capacity data for a pool, including all its products.
 * GET /capacity/pools/:poolId
 *
 * @param {Object} store - The Redux store containing application state.
 * @param {string|number} poolId - The pool ID.
 * @param {number} period - The coverage period in seconds.
 * @returns {Object|null} Pool capacity data or null if pool not found.
 */
function getPoolCapacity(store, poolId, period) {
  const { assets, assetRates } = store.getState();
  const now = BigNumber.from(Date.now()).div(1000);
  const productIds = selectProductsInPool(store, poolId);

  const productsCapacity = productIds
    .map(productId =>
      calculateProductCapacity(store, productId, {
        poolId,
        period,
        now,
        assets,
        assetRates,
        withPools: false,
      }),
    )
    .filter(Boolean); // remove any nulls (i.e. productId did not match any products)

  return {
    poolId: Number(poolId),
    utilizationRate: calculatePoolUtilizationRate(productsCapacity),
    productsCapacity,
  };
}

/**
 * Gets capacity data for a specific product in a specific pool.
 * GET /capacity/pools/:poolId/products/:productId
 *
 * @param {Object} store - The Redux store containing application state.
 * @param {string|number} poolId - The pool ID.
 * @param {string|number} productId - The product ID.
 * @param {number} period - The coverage period in seconds.
 * @param {number} editedCoverId - The ID of the cover which is edited. ID is 0 when getting capacity for a new cover.
 * @returns {Object|null} Product capacity data for the specific pool or null if not found.
 */
function getProductCapacityInPool(store, poolId, productId, period, editedCoverId = 0) {
  const { assets, assetRates } = store.getState();
  const now = BigNumber.from(Math.floor(Date.now() / 1000));

  const editedCover = getLatestCover(store, editedCoverId);

  const poolProductCapacity = calculateProductCapacity(store, productId, {
    poolId,
    period,
    now,
    assets,
    assetRates,
    withPools: false,
    editedCover,
  });

  return poolProductCapacity;
}

module.exports = {
  getAllProductCapacities,
  getProductCapacity,
  getPoolCapacity,
  getProductCapacityInPool,
  // Keep these exports for testing purposes
  calculateProductCapacity,
  calculatePoolUtilizationRate,
  calculateFirstUsableTrancheIndexForMaxPeriod,
};
