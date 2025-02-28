const { BigNumber, ethers } = require('ethers');

const { NXM_PER_ALLOCATION_UNIT, ONE_YEAR } = require('./constants');
const {
  calculateFirstUsableTrancheIndex,
  calculateBasePrice,
  calculatePremiumPerYear,
  calculateAvailableCapacityInNXM,
  getCapacitiesInAssets,
  divCeil,
  bnMin,
} = require('./helpers');
const {
  selectAssetRate,
  selectProductPools,
  selectProduct,
  selectProductPriorityPoolsFixedPrice,
} = require('../store/selectors');

const { WeiPerEther } = ethers.constants;
const { formatEther } = ethers.utils;

/**
 * This function allocates the requested amount in the provided list of pools in the provided order
 *
 * @param {BigNumber} coverAmount - The amount to be covered.
 * @param {Array<object>} pools - An array of pool data objects.
 * @returns {Array<object>} - An array of objects containing pool and allocation amount for that pool
 */
const calculatePoolAllocations = (coverAmount, pools) => {
  const allocations = [];
  let coverAmountLeft = coverAmount;

  for (const pool of pools) {
    if (pool.availableCapacityInNXM.lte(0)) {
      continue;
    }

    const allocation = {
      pool,
      amount: bnMin(pool.availableCapacityInNXM, coverAmountLeft),
    };

    coverAmountLeft = coverAmountLeft.sub(allocation.amount);
    allocations.push(allocation);

    if (coverAmountLeft.eq(0)) {
      break;
    }
  }

  if (coverAmountLeft > 0) {
    // not enough total capacity available
    return [];
  }

  return allocations;
};

/**
 * Sorts the pools based on the custom pool priority and the base price.
 *
 * @param {Array<object>} poolsData - An array of pool data objects
 * @param {Array<Number>} customPoolIdPriorityFixedPrice - An array of pool IDs in the desired order
 * @return {Array<object>} - A sorted array of pool data objects
 */
function sortPools(poolsData, customPoolIdPriorityFixedPrice) {
  const poolIdsByPrice = poolsData.sort((a, b) => a.basePrice - b.basePrice).map(p => p.poolId);

  const prioritized = new Set(customPoolIdPriorityFixedPrice.filter(poolId => poolIdsByPrice.includes(poolId)));
  const nonPrioritized = poolIdsByPrice.filter(poolId => !prioritized.has(poolId));
  const orderedPoolIds = [...prioritized, ...nonPrioritized];
  console.info('Priority ordered pools:', orderedPoolIds.join(', '));

  return orderedPoolIds.map(id => poolsData.find(p => p.poolId === id));
}

/**
 * Calculates the premium and allocations for a given insurance product based on the specified parameters.
 *
 * @param {object} store - The application state store.
 * @param {number} productId - The ID of the product to quote.
 * @param {BigNumber} amount - The amount of coverage requested.
 * @param {number} period - The cover period in seconds.
 * @param {string} coverAsset - The assetId of the asset to be covered.
 * @returns {Array<object>} - An array of objects containing pool allocations and premiums.
 */
const quoteEngine = (store, productId, amount, period, coverAsset) => {
  const product = selectProduct(store, productId);

  if (!product) {
    return null;
  }

  if (product.isDeprecated) {
    return {
      error: {
        isDeprecated: true,
      },
    };
  }

  const productPools = selectProductPools(store, productId);
  const assetRate = selectAssetRate(store, coverAsset);
  const { assets, assetRates } = store.getState();

  const now = BigNumber.from(Date.now()).div(1000);
  const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(now, product.gracePeriod, period);
  const coverAmountInNxm = amount.mul(WeiPerEther).div(assetRate);

  // rounding up to nearest allocation unit
  const amountToAllocate = divCeil(coverAmountInNxm, NXM_PER_ALLOCATION_UNIT).mul(NXM_PER_ALLOCATION_UNIT);
  console.info(`Amount to allocate: ${formatEther(amountToAllocate)} nxm`);

  const poolsData = productPools.map(pool => {
    const { poolId, targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = pool;

    const availableCapacityInNXM = calculateAvailableCapacityInNXM(
      trancheCapacities,
      allocations,
      firstUsableTrancheIndex,
    );

    const basePrice = product.useFixedPrice
      ? targetPrice
      : calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

    return {
      poolId,
      basePrice,
      availableCapacityInNXM,
    };
  });

  const customPoolIdPriorityFixedPrice = selectProductPriorityPoolsFixedPrice(store, productId) || [];
  const poolsInPriorityOrder = sortPools(poolsData, customPoolIdPriorityFixedPrice);
  const allocations = calculatePoolAllocations(amountToAllocate, poolsInPriorityOrder);

  const poolsWithPremium = allocations.map(allocation => {
    const pool = allocation.pool;
    const premiumPerYear = calculatePremiumPerYear(allocation.amount, pool.basePrice);

    const premiumInNxm = premiumPerYear.mul(period).div(ONE_YEAR);
    const premiumInAsset = premiumInNxm.mul(assetRate).div(WeiPerEther);

    const capacity = getCapacitiesInAssets(pool.availableCapacityInNXM, assets, assetRates);

    console.info('Pool:', pool.poolId);
    console.info('Available pool capacity:', formatEther(pool.availableCapacityInNXM), 'nxm');

    const coverAmountInAsset = allocation.amount.mul(assetRate).div(WeiPerEther);

    return {
      poolId: pool.poolId,
      premiumInNxm,
      premiumInAsset,
      coverAmountInNxm: allocation.amount,
      coverAmountInAsset,
      capacities: { poolId: pool.poolId, capacity },
    };
  });

  return poolsWithPremium;
};

module.exports = {
  quoteEngine,
  calculateBasePrice,
  calculatePremiumPerYear,
  calculatePoolAllocations,
};
