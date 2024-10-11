const { ethers, BigNumber } = require('ethers');

const { NXM_PER_ALLOCATION_UNIT, MAX_COVER_PERIOD } = require('./constants');
const { bnMax, bnMin, calculateTrancheId } = require('./helpers');
const { calculateBasePrice, calculatePremiumPerYear, calculateFixedPricePremiumPerYear } = require('./quoteEngine');
const { selectProduct, selectProductPools } = require('../store/selectors');

const { WeiPerEther, Zero } = ethers.constants;

const SECONDS_PER_DAY = BigNumber.from(24 * 3600);
const BASIS_POINTS = 10000;

/**
 * Calculates the utilization rate of the capacity.
 *
 * @param {Array<Object>} capacityInAssets - Array of asset objects containing assetId and amount.
 * @param {BigNumber} capacityUsedNXM - The amount of capacity used in NXM.
 * @returns {BigNumber} The utilization rate as a BigNumber, expressed in basis points (0-10,000).
 *                      Returns undefined if capacity in NXM is missing.
 */
function getUtilizationRate(capacityInAssets, capacityUsedNXM) {
  const availableCapacityInNxm = capacityInAssets.find(asset => asset.assetId === 255)?.amount;
  if (!availableCapacityInNxm || !capacityUsedNXM) {
    return undefined;
  }

  const totalCapacity = availableCapacityInNxm.add(capacityUsedNXM);
  if (totalCapacity.isZero()) {
    return BigNumber.from(0);
  }

  return capacityUsedNXM.mul(BASIS_POINTS).div(totalCapacity);
}

/**
 * Calculates available capacity for a pool.
 *
 * @param {Array<BigNumber>} trancheCapacities - Array of capacity BigNumbers.
 * @param {Array<BigNumber>} allocations - Array of allocation BigNumbers.
 * @param {number} firstUsableTrancheIndex - Index of the first usable tranche.
 * @returns {BigNumber} The available capacity as a BigNumber.
 */
function calculateAvailableCapacity(trancheCapacities, allocations, firstUsableTrancheIndex) {
  const unused = trancheCapacities.reduce((available, capacity, index) => {
    const allocationDifference = capacity.sub(allocations[index]);
    const allocationToAdd =
      index < firstUsableTrancheIndex
        ? bnMin(allocationDifference, Zero) // only carry over the negative
        : allocationDifference;
    return available.add(allocationToAdd);
  }, Zero);
  return bnMax(unused, Zero);
}

/**
 * Calculates capacity and pricing data for a specific tranche of product pools.
 *
 * @param {Array<Object>} productPools - Array of product pool objects.
 * @param {number} firstUsableTrancheIndex - Index of the first usable tranche.
 * @param {boolean} useFixedPrice - Flag indicating whether to use fixed pricing.
 * @param {BigNumber} now - Current timestamp in seconds.
 * @param {Object} assets - Object containing asset information.
 * @param {Object} assetRates - Object containing asset rates.
 * @returns {Object} An object containing aggregated data and capacity per pool.
 */
function calculateProductDataForTranche(productPools, firstUsableTrancheIndex, useFixedPrice, now, assets, assetRates) {
  const aggregatedData = {
    capacityUsedNXM: Zero,
    capacityAvailableNXM: Zero,
    minPrice: Zero,
    totalPremium: Zero,
  };

  const capacityPerPool = productPools.map(pool => {
    const { allocations, trancheCapacities, targetPrice, bumpedPrice, bumpedPriceUpdateTime, poolId } = pool;

    // calculating the capacity in allocation points
    const used = allocations.reduce((total, allocation) => total.add(allocation), Zero);
    const total = trancheCapacities.reduce((total, capacity) => total.add(capacity), Zero);

    const availableCapacity = calculateAvailableCapacity(trancheCapacities, allocations, firstUsableTrancheIndex);

    // convert to nxm
    const totalInNXM = total.mul(NXM_PER_ALLOCATION_UNIT);
    const usedInNXM = used.mul(NXM_PER_ALLOCATION_UNIT);
    const availableInNXM = availableCapacity.mul(NXM_PER_ALLOCATION_UNIT);

    aggregatedData.capacityUsedNXM = aggregatedData.capacityUsedNXM.add(usedInNXM);
    aggregatedData.capacityAvailableNXM = aggregatedData.capacityAvailableNXM.add(availableInNXM);

    if (availableCapacity.isZero()) {
      return {
        poolId,
        availableCapacity: [],
        allocatedNxm: usedInNXM.toString(),
        minAnnualPrice: Zero,
        maxAnnualPrice: Zero,
      };
    }

    const basePrice = useFixedPrice
      ? targetPrice
      : calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

    // the minimum price depends on the surge
    // so we buy the smallest possible unit of capacity
    // and calculate the premium per year
    const unitPremium = useFixedPrice
      ? calculateFixedPricePremiumPerYear(NXM_PER_ALLOCATION_UNIT, basePrice)
      : calculatePremiumPerYear(NXM_PER_ALLOCATION_UNIT, basePrice, usedInNXM, totalInNXM);

    const poolMinPrice = WeiPerEther.mul(unitPremium).div(NXM_PER_ALLOCATION_UNIT);

    // the maximum price a user would get can only be determined if the entire available
    // capacity is bought because the routing will always pick the cheapest
    // so we're summing up the premium for all pools and then calculate the average at the end
    const poolPremium = useFixedPrice
      ? calculateFixedPricePremiumPerYear(availableInNXM, basePrice)
      : calculatePremiumPerYear(availableInNXM, basePrice, usedInNXM, totalInNXM);

    const poolMaxPrice = availableInNXM.isZero() ? Zero : WeiPerEther.mul(poolPremium).div(availableInNXM);

    if (aggregatedData.minPrice.isZero() || poolMinPrice.lt(aggregatedData.minPrice)) {
      aggregatedData.minPrice = poolMinPrice;
    }
    aggregatedData.totalPremium = aggregatedData.totalPremium.add(poolPremium);

    const availableCapacityInAssets = Object.keys(assets).map(assetId => ({
      assetId: Number(assetId),
      amount: availableInNXM.mul(assetRates[assetId]).div(WeiPerEther),
      asset: assets[assetId],
    }));

    return {
      poolId,
      availableCapacity: availableCapacityInAssets,
      allocatedNxm: usedInNXM,
      minAnnualPrice: poolMinPrice,
      maxAnnualPrice: poolMaxPrice,
    };
  });

  return { aggregatedData, capacityPerPool };
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
 * Calculates tranche indices for capacity calculations based on time and product data.
 *
 * @param {BigNumber} time - The current timestamp in seconds.
 * @param {Object} product - The product object containing product details.
 * @param {number} period - The coverage period in days.
 * @returns {Object} Contains indices for the first usable tranche / first usable tranche for the maximum period.
 */
function calculateTrancheInfo(time, product, period) {
  const firstActiveTrancheId = calculateTrancheId(time);
  const gracePeriodExpiration = time.add(SECONDS_PER_DAY.mul(period)).add(product.gracePeriod);
  const firstUsableTrancheId = calculateTrancheId(gracePeriodExpiration);
  const firstUsableTrancheIndex = firstUsableTrancheId - firstActiveTrancheId;
  const firstUsableTrancheForMaxPeriodId = calculateTrancheId(time.add(MAX_COVER_PERIOD).add(product.gracePeriod));
  const firstUsableTrancheForMaxPeriodIndex = firstUsableTrancheForMaxPeriodId - firstActiveTrancheId;

  return {
    firstUsableTrancheIndex,
    firstUsableTrancheForMaxPeriodIndex,
  };
}

/**
 * Calculates the capacity and pricing information for products and pools.
 *
 * @param {Object} store - The Redux store containing application state.
 * @param {Object} [options={}] - Optional parameters for capacity calculation.
 * @param {number|null} [options.poolId=null] - The ID of the pool to filter products by.
 * @param {Array<number>} [options.productIds=[]] - Array of product IDs to process.
 * @param {number} [options.period=30] - The coverage period in days.
 * @param {boolean} [options.withPools=false] - Flag indicating whether to include capacityPerPool data field.
 * @returns {Array<Object>} An array of capacity information objects for each product.
 */
function capacityEngine(store, { poolId = null, productIds = [], period = 30, withPools = false } = {}) {
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

    const { firstUsableTrancheIndex, firstUsableTrancheForMaxPeriodIndex } = calculateTrancheInfo(now, product, period);

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
    const capacityInAssets = Object.keys(assets).map(assetId => ({
      assetId: Number(assetId),
      amount: capacityAvailableNXM.mul(assetRates[assetId]).div(WeiPerEther),
      asset: assets[assetId],
    }));

    const capacityData = {
      productId: Number(productId),
      availableCapacity: capacityInAssets,
      usedCapacity: capacityUsedNXM,
      utilizationRate: getUtilizationRate(capacityInAssets, capacityUsedNXM),
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
  calculateAvailableCapacity,
  calculateProductDataForTranche,
  getProductsInPool,
  calculateTrancheInfo,
  capacityEngine,
};
