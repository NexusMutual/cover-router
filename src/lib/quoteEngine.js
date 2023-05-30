const { BigNumber, ethers } = require('ethers');
const { calculateTrancheId, divCeil } = require('./helpers');
const { selectAssetRate, selectProductPools, selectProduct } = require('../store/selectors');

const { WeiPerEther, Zero, MaxUint256 } = ethers.constants;
const { formatEther } = ethers.utils;

const { bnMax } = require('./helpers');

const {
  NXM_PER_ALLOCATION_UNIT,
  ONE_YEAR,
  PRICE_CHANGE_PER_DAY,
  SURGE_PRICE_RATIO,
  SURGE_THRESHOLD_DENOMINATOR,
  SURGE_THRESHOLD_RATIO,
  TARGET_PRICE_DENOMINATOR,
  MIN_UNIT_SIZE_DAI,
} = require('./constants');

const UNIT_DIVISOR = 10;

const calculateBasePrice = (targetPrice, bumpedPrice, bumpedPriceUpdateTime, now) => {
  const elapsed = now.sub(bumpedPriceUpdateTime);
  const priceDrop = elapsed.mul(PRICE_CHANGE_PER_DAY).div(3600 * 24);
  return bnMax(targetPrice, bumpedPrice.sub(priceDrop));
};

const calculateFixedPricePremiumPerYear = (coverAmount, price) => {
  return coverAmount.mul(price).div(TARGET_PRICE_DENOMINATOR);
};

const calculatePremiumPerYear = (coverAmount, basePrice, initialCapacityUsed, totalCapacity) => {
  const basePremium = coverAmount.mul(basePrice).div(TARGET_PRICE_DENOMINATOR);
  const finalCapacityUsed = initialCapacityUsed.add(coverAmount);
  const surgeStartPoint = totalCapacity.mul(SURGE_THRESHOLD_RATIO).div(SURGE_THRESHOLD_DENOMINATOR);

  if (finalCapacityUsed.lte(surgeStartPoint)) {
    return basePremium;
  }

  const amountOnSurgeSkip = initialCapacityUsed.sub(surgeStartPoint).gt(0)
    ? initialCapacityUsed.sub(surgeStartPoint)
    : Zero;

  const amountOnSurge = finalCapacityUsed.sub(surgeStartPoint);
  const totalSurgePremium = amountOnSurge.mul(amountOnSurge).mul(SURGE_PRICE_RATIO).div(totalCapacity).div(2);
  const skipSurgePremium = amountOnSurgeSkip.mul(amountOnSurgeSkip).mul(SURGE_PRICE_RATIO).div(totalCapacity).div(2);
  const surgePremium = totalSurgePremium.sub(skipSurgePremium);

  return basePremium.add(surgePremium);
};

/**
 * This function allocates each unit to the cheapest opportunity available for that unit
 * at that time given the allocations at the previous points.
 *
 * To solve the allocation problem we split the amount A in U = `A / UNIT_SIZE + 1`
 * units and use that for the rest of the computations.
 *
 * To allocate the units U we take each unit at a time from 0 to U,
 * and allocate each unit to the *best* pool available in terms of price
 * as long as the pool has enough capacity for that unit.
 *
 * If there is no pool with capacity available for a unit of allocation the function returns
 * with an empty list (aborts allocation completely - no partial allocations supported).
 *
 * UNIT_SIZE is dynamically computed as 0.1% (1 / UNIT_DIVISOR) of the cover amount.
 * It has a minimum which is 1e18 (can't go below 1 ETH or 1 DAI).
 *
 * Complexity O(n * p)  where n is the number of units in the amount and p is th  e number of pools
 * @param coverAmount
 * @param pools
 * @param minUnitSize
 * @param useFixedPrice
 * @returns {{lowestCostAllocation: *, lowestCost: *}}
 */
const calculateOptimalPoolAllocation = (coverAmount, pools, minUnitSize, useFixedPrice) => {
  // set unitSize to be a minimum of 1.
  const unitSize = coverAmount.div(UNIT_DIVISOR).gt(minUnitSize) ? coverAmount.div(UNIT_DIVISOR) : minUnitSize;

  let premium = BigNumber.from(0);
  // Pool Id (number) -> Capacity Amount (BigNumber)
  const allocations = {};

  // Pool Id (number) -> Capacity Amount (BigNumber)
  const poolCapacityUsed = {};

  for (const pool of pools) {
    poolCapacityUsed[pool.poolId] = pool.initialCapacityUsed;
  }

  let coverAmountLeft = coverAmount;
  while (coverAmountLeft.gt(0)) {
    const amountToAllocate = coverAmountLeft.gte(unitSize) ? unitSize : coverAmountLeft;

    let lowestCostPerPool = MaxUint256;
    let lowestCostPoolId = 0;
    for (const pool of pools) {
      // we advance one unit size at a time

      if (poolCapacityUsed[pool.poolId].add(amountToAllocate).gt(pool.totalCapacity)) {
        // can't allocate unit to pool
        continue;
      }

      const premium = useFixedPrice
        ? calculateFixedPricePremiumPerYear(amountToAllocate, pool.basePrice)
        : calculatePremiumPerYear(amountToAllocate, pool.basePrice, poolCapacityUsed[pool.poolId], pool.totalCapacity);

      if (premium.lt(lowestCostPerPool)) {
        lowestCostPerPool = premium;
        lowestCostPoolId = pool.poolId;
      }
    }

    premium = premium.add(lowestCostPerPool);

    if (lowestCostPoolId === 0) {
      // not enough total capacity available
      return [];
    }

    if (!allocations[lowestCostPoolId]) {
      allocations[lowestCostPoolId] = BigNumber.from(0);
    }
    allocations[lowestCostPoolId] = allocations[lowestCostPoolId].add(amountToAllocate);
    poolCapacityUsed[lowestCostPoolId] = poolCapacityUsed[lowestCostPoolId].add(amountToAllocate);

    coverAmountLeft = coverAmountLeft.sub(amountToAllocate);
  }

  return allocations;
};

const quoteEngine = (store, productId, amount, period, coverAsset) => {
  const product = selectProduct(store, productId);

  if (!product) {
    return null;
  }
  const productPools = selectProductPools(store, productId);
  const assetRate = selectAssetRate(store, coverAsset);
  const assetRates = store.getState().assetRates;

  const now = BigNumber.from(Date.now()).div(1000);
  const gracePeriodExpiration = now.add(period).add(product.gracePeriod);

  const firstActiveTrancheId = calculateTrancheId(now);
  const firstUsableTrancheId = calculateTrancheId(gracePeriodExpiration);
  const firstUsableTrancheIndex = firstUsableTrancheId - firstActiveTrancheId;

  // TODO: use asset decimals instead of generic 18 decimals
  const coverAmountInNxm = amount.mul(WeiPerEther).div(assetRate);

  // rounding up to nearest allocation unit
  const amountToAllocate = divCeil(coverAmountInNxm, NXM_PER_ALLOCATION_UNIT).mul(NXM_PER_ALLOCATION_UNIT);
  console.log('Amount to allocate:', formatEther(amountToAllocate), 'nxm');

  const poolsData = productPools.map(pool => {
    const { poolId, targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = pool;

    const totalCapacity = trancheCapacities
      .slice(firstUsableTrancheIndex)
      .reduce((total, capacity) => total.add(capacity), Zero)
      .mul(NXM_PER_ALLOCATION_UNIT);

    const initialCapacityUsed = allocations
      .slice(firstUsableTrancheIndex)
      .reduce((total, allocation) => total.add(allocation), Zero)
      .mul(NXM_PER_ALLOCATION_UNIT);

    const basePrice = product.useFixedPrice
      ? targetPrice
      : calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

    return {
      poolId,
      basePrice,
      initialCapacityUsed,
      totalCapacity,
    };
  });

  const { assets } = store.getState();
  const daiRate = assetRates[assets.DAI];
  const minUnitSizeInNxm = MIN_UNIT_SIZE_DAI.mul(daiRate).div(WeiPerEther);

  const allocations = calculateOptimalPoolAllocation(
    amountToAllocate,
    poolsData,
    minUnitSizeInNxm,
    product.useFixedPrice,
  );

  const poolsWithPremium = Object.keys(allocations).map(poolId => {
    poolId = parseInt(poolId);

    const amountToAllocate = allocations[poolId];

    const pool = poolsData.find(data => poolId.toString() === data.poolId.toString());

    const premiumPerYear = product.useFixedPrice
      ? calculateFixedPricePremiumPerYear(amountToAllocate, pool.basePrice)
      : calculatePremiumPerYear(amountToAllocate, pool.basePrice, pool.initialCapacityUsed, pool.totalCapacity);

    const premiumInNxm = premiumPerYear.mul(period).div(ONE_YEAR);

    // TODO: use asset decimals instead of generic 18 decimals
    const premiumInAsset = premiumInNxm.mul(assetRate).div(WeiPerEther);

    const capacityInNxm = pool.totalCapacity.sub(pool.initialCapacityUsed);
    const capacity = Object.entries(assetRates).map(([assetId, rate]) => ({
      assetId,
      amount: capacityInNxm.mul(rate).div(WeiPerEther),
    }));

    console.log('Pool:', poolId);
    console.log('Initially used capacity:', formatEther(pool.initialCapacityUsed), 'nxm');
    console.log('Total pool capacity    :', formatEther(pool.totalCapacity), 'nxm');
    console.log('Pool capacity          :', formatEther(capacityInNxm), 'nxm');

    return {
      poolId,
      premiumInNxm,
      premiumInAsset,
      coverAmountInNxm,
      coverAmountInAsset: amount,
      capacities: { poolId: pool.poolId, capacity },
    };
  });

  return poolsWithPremium;
};

module.exports = {
  quoteEngine,
  calculateBasePrice,
  calculateFixedPricePremiumPerYear,
  calculatePremiumPerYear,
  calculateOptimalPoolAllocation,
};
