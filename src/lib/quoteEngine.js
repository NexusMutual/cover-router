const { inspect } = require('util');

const { BigNumber, ethers } = require('ethers');

const { NXM_PER_ALLOCATION_UNIT, ONE_YEAR, CAPACITY_MARGIN_DIVISOR } = require('./constants');
const {
  calculateFirstUsableTrancheIndex,
  calculateBasePrice,
  calculatePremiumPerYear,
  divCeil,
  bnMin,
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
 * This function calculates optimal allocation based on the current pool prices
 *
 * It sorts pools by the base price and then takes full capacity from the pools with
 * the lower prices until it reaches desired coverAmount
 * @param {number} coverAmount - The amount to be covered.
 * @param {Array<object>} pools - An array of pool data objects.
 * @returns {object} - An object containing the allocations by pool ID. (poolId => BigNumber amount)
 */
const calculateOptimalPoolAllocation = (coverAmount, pools) => {
  // Pool Id (number) -> Capacity Amount (BigNumber)
  const allocations = {};

  let coverAmountLeft = coverAmount;

  pools.sort((a, b) => a.basePrice - b.basePrice);

  for (const pool of pools) {
    let availableCapacity = pool.totalCapacity.sub(pool.initialCapacityUsed);

    // don't take all available capacity because it can change when executing tx due to small change in NXM price
    availableCapacity = availableCapacity.sub(availableCapacity.div(CAPACITY_MARGIN_DIVISOR));

    if (availableCapacity.eq(0)) {
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
 * Allocates a given amount to pools based on a custom pool ID priority list.
 *
 * @param {number} amountToAllocate - The amount to be allocated.
 * @param {Array<object>} poolsData - An array of pool data objects.
 * @param {Array<number>} customPoolIdPriority - A list of pool IDs in priority order.
 * @return {object} An object containing the allocations by pool ID. (poolId => BigNumber amount)
 */
const customAllocationPriorityFixedPrice = (amountToAllocate, poolsData, customPoolIdPriority) => {
  const allocations = {};
  let coverAmountLeft = amountToAllocate;
  const customPoolIdPriorityCopy = customPoolIdPriority.slice(0); // avoid mutation on the customPoolIdPriority array

  while (coverAmountLeft > 0 && customPoolIdPriorityCopy.length > 0) {
    const poolId = customPoolIdPriorityCopy.shift();
    const pool = poolsData.find(poolData => poolData.poolId === poolId);
    if (!pool) {
      console.warn(`Unable to find pool ${poolId} in poolsData array. Skipping\n`);
      console.warn(`Available poolIds in poolsData: ${poolsData.map(p => p.poolId).join(', ')}`);
      console.debug('poolsData: ', inspect(poolsData, { depth: null }));
      continue;
    }

    let availableCapacity = pool.totalCapacity.sub(pool.initialCapacityUsed);

    // don't take all available capacity because it can change when executing tx due to small change in NXM price
    availableCapacity = availableCapacity.sub(availableCapacity.div(CAPACITY_MARGIN_DIVISOR));

    const poolAllocation = bnMin(availableCapacity, coverAmountLeft);

    allocations[poolId] = poolAllocation;
    coverAmountLeft = coverAmountLeft.gt(poolAllocation) ? coverAmountLeft.sub(poolAllocation) : 0;
  }

  if (coverAmountLeft > 0) {
    // not enough total capacity available
    return {};
  }

  return allocations;
};

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

  const customPoolIdPriorityFixedPrice = selectProductPriorityPoolsFixedPrice(store, productId);

  const allocations = customPoolIdPriorityFixedPrice
    ? customAllocationPriorityFixedPrice(amountToAllocate, poolsData, customPoolIdPriorityFixedPrice)
    : calculateOptimalPoolAllocation(amountToAllocate, poolsData);

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
  calculateOptimalPoolAllocation,
  customAllocationPriorityFixedPrice,
};
