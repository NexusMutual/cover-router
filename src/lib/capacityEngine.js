const { ethers, BigNumber } = require('ethers');

const { NXM_PER_ALLOCATION_UNIT, MAX_COVER_PERIOD } = require('./constants');
const { bnMax, bnMin, calculateTrancheId } = require('./helpers');
const { calculateBasePrice, calculatePremiumPerYear, calculateFixedPricePremiumPerYear } = require('./quoteEngine');
const { selectAsset, selectProduct, selectProductPools } = require('../store/selectors');

const { WeiPerEther, Zero } = ethers.constants;

const SECONDS_PER_DAY = BigNumber.from(24 * 3600);

/**
 * Calculates capacity and pricing data for a specific tranche of product pools.
 *
 * @param {Array<Object>} productPools - Array of product pool objects.
 * @param {number} firstUsableTrancheIndex - Index of the first usable tranche.
 * @param {boolean} useFixedPrice - Flag indicating whether to use fixed pricing.
 * @param {BigNumber} now - Current timestamp in seconds.
 * @returns {Object} An object containing capacity used, capacity available, minimum price, and total premium.
 */
function calculateProductDataForTranche(productPools, firstUsableTrancheIndex, useFixedPrice, now) {
  return productPools.reduce(
    (accumulated, pool) => {
      const { capacityUsedNXM, capacityAvailableNXM, minPrice, totalPremium } = accumulated;
      const { allocations, trancheCapacities, targetPrice, bumpedPrice, bumpedPriceUpdateTime } = pool;

      // calculating the capacity in allocation points
      const used = allocations.reduce((total, allocation) => total.add(allocation), Zero);
      const total = trancheCapacities.reduce((total, capacity) => total.add(capacity), Zero);

      const unused = trancheCapacities.reduce((available, capacity, index) => {
        const allocationDifference = capacity.sub(allocations[index]);
        return index < firstUsableTrancheIndex
          ? available.add(bnMin(allocationDifference, Zero)) // only carry over the negative
          : available.add(allocationDifference);
      }, Zero);

      const availableCapacity = bnMax(unused, Zero);

      // convert to nxm
      const totalInNXM = total.mul(NXM_PER_ALLOCATION_UNIT);
      const usedInNxm = used.mul(NXM_PER_ALLOCATION_UNIT);
      const availableInNXM = availableCapacity.mul(NXM_PER_ALLOCATION_UNIT);

      if (availableCapacity.isZero()) {
        // only add up the used capacity and return the same values for the rest
        return {
          capacityUsedNXM: usedInNxm.add(capacityUsedNXM),
          capacityAvailableNXM,
          minPrice,
          totalPremium,
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
        : calculatePremiumPerYear(NXM_PER_ALLOCATION_UNIT, basePrice, usedInNxm, totalInNXM);

      const poolMinPrice = WeiPerEther.mul(unitPremium).div(NXM_PER_ALLOCATION_UNIT);

      // the maximum price a user would get can only be determined if the entire available
      // capacity is bought because the routing will always pick the cheapest
      // so we're summing up the premium for all pools and then calculate the average at the end
      const poolPremium = useFixedPrice
        ? calculateFixedPricePremiumPerYear(availableInNXM, basePrice)
        : calculatePremiumPerYear(availableInNXM, basePrice, usedInNxm, totalInNXM);

      return {
        capacityUsedNXM: usedInNxm.add(capacityUsedNXM),
        capacityAvailableNXM: availableInNXM.add(capacityAvailableNXM),
        minPrice: minPrice.eq(Zero) ? poolMinPrice : bnMin(minPrice, poolMinPrice),
        totalPremium: totalPremium.add(poolPremium),
      };
    },
    { capacityUsedNXM: Zero, capacityAvailableNXM: Zero, minPrice: Zero, totalPremium: Zero },
  );
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
 * @returns {Array<Object>} An array of capacity information objects for each product.
 */
function capacityEngine(store, { poolId = null, productIds = [], period = 30 } = {}) {
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
    const productPools = selectProductPools(store, productId, poolId);

    if (product.useFixedPrice) {
      // Fixed Price
      const productData = calculateProductDataForTranche(productPools, firstUsableTrancheIndex, true, now);

      const { capacityAvailableNXM, capacityUsedNXM, minPrice, totalPremium } = productData;

      const maxAnnualPrice = capacityAvailableNXM.isZero()
        ? Zero
        : WeiPerEther.mul(totalPremium).div(capacityAvailableNXM);

      const capacityInAssets = Object.keys(assets).map(assetId => ({
        assetId: Number(assetId),
        amount: capacityAvailableNXM.mul(assetRates[assetId]).div(WeiPerEther),
        asset: selectAsset(store, assetId),
      }));

      capacities.push({
        productId: Number(productId),
        availableCapacity: capacityInAssets,
        usedCapacity: capacityUsedNXM,
        minAnnualPrice: minPrice,
        maxAnnualPrice,
      });
    } else {
      // Non-fixed Price
      let productData = {};
      let maxAnnualPrice = BigNumber.from(0);

      // use the first 6 tranches (over 1 year) for calculating the max annual price
      for (let i = 0; i <= firstUsableTrancheForMaxPeriodIndex; i++) {
        const productTrancheData = calculateProductDataForTranche(productPools, i, false, now);

        if (i === firstUsableTrancheIndex) {
          productData = productTrancheData;
        }

        const { capacityAvailableNXM, totalPremium } = productTrancheData;

        const maxTrancheAnnualPrice = capacityAvailableNXM.isZero()
          ? Zero
          : WeiPerEther.mul(totalPremium).div(capacityAvailableNXM);

        maxAnnualPrice = bnMax(maxAnnualPrice, maxTrancheAnnualPrice);
      }

      const { capacityAvailableNXM, capacityUsedNXM, minPrice } = productData;
      const capacityInAssets = Object.keys(assets).map(assetId => ({
        assetId: Number(assetId),
        amount: capacityAvailableNXM.mul(assetRates[assetId]).div(WeiPerEther),
        asset: selectAsset(store, assetId),
      }));

      capacities.push({
        productId: Number(productId),
        availableCapacity: capacityInAssets,
        usedCapacity: capacityUsedNXM,
        minAnnualPrice: minPrice,
        maxAnnualPrice,
      });
    }
  }

  return capacities;
}

module.exports = capacityEngine;
