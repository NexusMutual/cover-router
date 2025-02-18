const { inspect } = require('util');

const { BigNumber, ethers } = require('ethers');

const {
  NXM_PER_ALLOCATION_UNIT,
  ONE_YEAR,
  CAPACITY_BUFFER_MINIMUM,
  CAPACITY_BUFFER_RATIO,
  CAPACITY_BUFFER_DENOMINATOR,
} = require('./constants');
const {
  calculateFirstUsableTrancheIndex,
  calculateBasePrice,
  calculatePremiumPerYear,
  divCeil,
  bnMin,
  bnMax,
} = require('./helpers');
const {
  selectAsset,
  selectAssetRate,
  selectProductPools,
  selectProduct,
  selectProductPriorityPoolsFixedPrice,
} = require('../store/selectors');

const { WeiPerEther, Zero } = ethers.constants;
const { formatEther } = ethers.utils;

/**
 * This function allocates the requested amount in the provided list of pools in the provided order
 *
 * @param {BigNumber} coverAmount - The amount to be covered.
 * @param {Array<object>} pools - An array of pool data objects.
 * @returns {object} - An object containing the allocations by pool ID. (poolId => BigNumber amount)
 */
const calculatePoolAllocations = (coverAmount, pools) => {
  // pool id (number) -> capacity amount
  const allocations = {};
  let coverAmountLeft = coverAmount;

  for (const pool of pools) {
    const actualCapacity = pool.totalCapacity.sub(pool.initialCapacityUsed);
    const capacityBuffer = bnMax(
      actualCapacity.mul(CAPACITY_BUFFER_RATIO).div(CAPACITY_BUFFER_DENOMINATOR),
      CAPACITY_BUFFER_MINIMUM,
    );
    const availableCapacity = bnMax(actualCapacity.sub(capacityBuffer), Zero);

    if (availableCapacity.lte(0)) {
      continue;
    }

    allocations[pool.poolId] = bnMin(availableCapacity, coverAmountLeft);
    coverAmountLeft = coverAmountLeft.sub(allocations[pool.poolId]);

    if (coverAmountLeft.eq(0)) {
      break;
    }
  }

  if (coverAmountLeft > 0) {
    // not enough total capacity available
    return {};
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
  const allPoolIds = poolsData.map(p => p.poolId);

  const prioritized = new Set(customPoolIdPriorityFixedPrice.filter(poolId => allPoolIds.includes(poolId)));
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
  const assetRates = store.getState().assetRates;

  const now = BigNumber.from(Date.now()).div(1000);
  const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(now, product.gracePeriod, period);
  const coverAmountInNxm = amount.mul(WeiPerEther).div(assetRate);

  // rounding up to nearest allocation unit
  const amountToAllocate = divCeil(coverAmountInNxm, NXM_PER_ALLOCATION_UNIT).mul(NXM_PER_ALLOCATION_UNIT);
  console.info(`Amount to allocate: ${formatEther(amountToAllocate)} nxm`);

  const poolsData = productPools.map(pool => {
    const { poolId, targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = pool;

    const totalCapacity = trancheCapacities
      .slice(firstUsableTrancheIndex)
      .reduce((total, capacity) => total.add(capacity), Zero)
      .mul(NXM_PER_ALLOCATION_UNIT);

    const initialCapacityUsed = trancheCapacities
      .reduce((used, capacity, index) => {
        if (index < firstUsableTrancheIndex) {
          const carryOver = capacity.sub(allocations[index]);
          return carryOver.lt(0) ? used.add(carryOver.abs()) : used;
        }
        return used.add(allocations[index]);
      }, Zero)
      .mul(NXM_PER_ALLOCATION_UNIT);

    const basePrice = product.useFixedPrice
      ? targetPrice
      : calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

    if (totalCapacity.lte(initialCapacityUsed)) {
      return {
        poolId,
        basePrice,
        initialCapacityUsed: Zero,
        totalCapacity: Zero,
      };
    }

    return {
      poolId,
      basePrice,
      initialCapacityUsed,
      totalCapacity,
    };
  });

  const customPoolIdPriorityFixedPrice = selectProductPriorityPoolsFixedPrice(store, productId) || [];
  const poolsInPriorityOrder = sortPools(poolsData, customPoolIdPriorityFixedPrice);
  const allocations = calculatePoolAllocations(amountToAllocate, poolsInPriorityOrder);

  const poolsWithPremium = Object.keys(allocations).map(poolId => {
    poolId = parseInt(poolId);

    const amountToAllocate = allocations[poolId];

    const pool = poolsData.find(data => poolId.toString() === data.poolId.toString());
    if (!pool) {
      console.info(`Available poolIds in poolsData: ${poolsData.map(p => p.poolId).join(', ')}`);
      console.debug('poolsData: ', inspect(poolsData, { depth: null }));
      throw new Error(`Unable to find pool ${poolId} in poolsData`);
    }

    const premiumPerYear = calculatePremiumPerYear(amountToAllocate, pool.basePrice);

    const premiumInNxm = premiumPerYear.mul(period).div(ONE_YEAR);
    const premiumInAsset = premiumInNxm.mul(assetRate).div(WeiPerEther);

    const capacityInNxm = pool.totalCapacity.sub(pool.initialCapacityUsed);
    const capacity = Object.entries(assetRates).map(([assetId, rate]) => ({
      assetId,
      amount: capacityInNxm.mul(rate).div(WeiPerEther),
      asset: selectAsset(store, assetId),
    }));

    console.info('Pool:', poolId);
    console.info('Initially used capacity:', formatEther(pool.initialCapacityUsed), 'nxm');
    console.info('Total pool capacity    :', formatEther(pool.totalCapacity), 'nxm');
    console.info('Pool capacity          :', formatEther(capacityInNxm), 'nxm');

    const coverAmountInAsset = amountToAllocate.mul(assetRate).div(WeiPerEther);

    return {
      poolId,
      premiumInNxm,
      premiumInAsset,
      coverAmountInNxm: amountToAllocate,
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
