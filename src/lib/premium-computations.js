const { BigNumber, ethers } = require('ethers');
const { bnMax } = require('./helpers');

const { MaxUint256, WeiPerEther, Zero } = ethers.constants;

const MIN_UNIT_SIZE = WeiPerEther;
const UNIT_DIVISOR = 1000;

const {
  PRICE_CHANGE_PER_DAY,
  SURGE_PRICE_RATIO,
  SURGE_THRESHOLD_DENOMINATOR,
  SURGE_THRESHOLD_RATIO,
  TARGET_PRICE_DENOMINATOR,
} = require('./constants');
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
 * @param useFixedPrice
 * @returns {{lowestCostAllocation: *, lowestCost: *}}
 */
const calculateOptimalPoolAllocationGreedy = (coverAmount, pools, useFixedPrice) => {

  // set UNIT_SIZE to be a minimum of 1.
  const UNIT_SIZE = coverAmount.div(UNIT_DIVISOR).gt(MIN_UNIT_SIZE) ? coverAmount.div(UNIT_DIVISOR) : MIN_UNIT_SIZE;

  // compute the extra amount of units (0 or 1) to be added based on the division remainder.
  const extra = coverAmount.mod(UNIT_SIZE).gt(0) ? 1 : 0;

  const amountInUnits = coverAmount.div(UNIT_SIZE).add(extra).toNumber();

  // the amount padding is the amount added artificially added when adding a whole unit
  // to account for the remainder
  const amountPadding = extra === 1 ? UNIT_SIZE.sub(coverAmount.mod(UNIT_SIZE)) : BigNumber.from(0);

  let lowestCost = BigNumber.from(0);
  // Pool Id (number) -> Capacity Amount (BigNumber)
  const lowestCostAllocation = {};

  // Pool Id (number) -> Capacity Amount (BigNumber)
  const poolCapacityUsed = {};

  for (const pool of pools) {
    poolCapacityUsed[pool.poolId] = pool.initialCapacityUsed;
  }

  let lastPoolIdUsed;
  for (let i = 0; i < amountInUnits; i++) {
    let lowestCostPerPool = MaxUint256;
    let lowestCostPool;
    for (const pool of pools) {
      // we advance one unit size at a time
      const amountInWei = UNIT_SIZE;

      if (poolCapacityUsed[pool.poolId].add(amountInWei).gt(pool.totalCapacity)) {
        // can't allocate unit to pool
        continue;
      }

      const premium = useFixedPrice
        ? calculateFixedPricePremiumPerYear(amountInWei, pool.basePrice)
        : calculatePremiumPerYear(amountInWei, pool.basePrice, poolCapacityUsed[pool.poolId], pool.totalCapacity);

      if (premium.lt(lowestCostPerPool)) {
        lowestCostPerPool = premium;
        lowestCostPool = pool;
      }
    }

    lowestCost = lowestCost.add(lowestCostPerPool);

    if (!lowestCostPool) {
      // not enough total capacity available
      return { lowestCostAllocation: [] };
    }

    if (!lowestCostAllocation[lowestCostPool.poolId]) {
      lowestCostAllocation[lowestCostPool.poolId] = BigNumber.from(0);
    }
    lowestCostAllocation[lowestCostPool.poolId] = lowestCostAllocation[lowestCostPool.poolId].add(UNIT_SIZE);
    poolCapacityUsed[lowestCostPool.poolId] = poolCapacityUsed[lowestCostPool.poolId].add(UNIT_SIZE);

    lastPoolIdUsed = lowestCostPool.poolId;
  }

  // the amount padding is subtracted from the last pool used so that all allocated amounts
  // across pools sum up to coverAmount
  lowestCostAllocation[lastPoolIdUsed] = lowestCostAllocation[lastPoolIdUsed].sub(amountPadding);

  return { lowestCostAllocation, lowestCost };
};
const calculateOptimalPoolAllocation = (coverAmount, pools, useFixedPrice) => {
  return calculateOptimalPoolAllocationGreedy(coverAmount, pools, useFixedPrice);
};

module.exports = {
  calculateBasePrice,
  calculateFixedPricePremiumPerYear,
  calculatePremiumPerYear,
  calculateOptimalPoolAllocation,
};
