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
 * Calculates the capacity and pricing information for products and pools.
 *
 * @param {Object} store - The Redux store containing application state.
 * @param {Object} [options={}] - Optional parameters for capacity calculation.
 * @param {number|null} [options.poolId=null] - The ID of the pool to filter products by.
 * @param {Array<number>} [options.productIds=[]] - Array of product IDs to process.
 * @param {number} [options.periodSeconds=30*SECONDS_PER_DAY] - The coverage period in seconds
 * @param {boolean} [options.withPools=false] - Flag indicating whether to include capacityPerPool data field.
 * @returns {Array<Object>} An array of capacity information objects for each product.
 */
function capacityEngine(
  store,
  { poolId = null, productIds = [], periodSeconds = SECONDS_PER_DAY.mul(30), withPools = false } = {},
) {
  const { assets, assetRates, products } = store.getState();
  const now = BigNumber.from(Date.now()).div(1000);
  const capacities = [];

  let productIdsToProcess;
  if (productIds.length > 0) {
    productIdsToProcess = [...productIds];
  } else if (poolId !== null) {
    // If only poolId is provided, get all products in that pool
    productIdsToProcess = getProductsInPool(store, poolId);
  } else {
    // If neither productIds nor poolId is provided, process all products
    productIdsToProcess = Object.keys(products);
  }

  for (const productId of productIdsToProcess) {
    const product = selectProduct(store, productId);

    if (!product) {
      continue;
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
      utilizationRate: getUtilizationRate(capacityAvailableNXM, capacityUsedNXM),
      minAnnualPrice: minPrice,
      maxAnnualPrice,
    };

    if (withPools) {
      capacityData.capacityPerPool = capacityPerPool;
    }

    capacities.push(capacityData);
  }

  return capacities;
}

module.exports = {
  getUtilizationRate,
  calculateFirstUsableTrancheForMaxPeriodIndex,
  getProductsInPool,
  capacityEngine,
};
