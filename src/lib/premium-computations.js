const { MaxUint256, WeiPerEther, Zero } = require('ethers').constants;
const { bnMax } = require('./helpers');
const {
  PRICE_CHANGE_PER_DAY,
  SURGE_PRICE_RATIO,
  SURGE_THRESHOLD_DENOMINATOR,
  SURGE_THRESHOLD_RATIO,
  TARGET_PRICE_DENOMINATOR,
} = require('./constants');

const MIN_CHUNK_SIZE = WeiPerEther;

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
 * To solve the allocation problem we split the amount A in max 10 chunks (or less if A < MIN_SIZE).
 *
 * To allocate the units U we take each unit at a time from 0 to U,
 * and allocate each unit to the *best* pool available in terms of price
 * as long as the pool has enough capacity for that unit.
 *
 * If there is no pool with capacity available for a unit of allocation the function returns
 * with an empty list.
 *
 * Complexity O(n) where n is the number of pools
 * @param coverAmount
 * @param pools
 * @returns {[{poolId: Number, amount: BigNumber }]}
 */
const calculateOptimalPoolAllocation = (coverAmount, pools) => {
  const tenth = coverAmount.div(10);
  const chunk = tenth.lt(MIN_CHUNK_SIZE) ? MIN_CHUNK_SIZE : tenth;
  let unallocatedAmount = coverAmount;

  // pool id (number) -> used capacity (BigNumber)
  const poolCapacities = Object.fromEntries(
    pools.map(pool => [pool.poolId, { initial: pool.initialCapacityUsed, total: pool.totalCapacity }]),
  );

  // pool id (number) -> allocation (BigNumber)
  const allocations = {};

  while (unallocatedAmount.gt(0)) {
    const amount = unallocatedAmount.lt(chunk) ? unallocatedAmount : chunk;

    const cheapestPool = pools
      // filter out pools with insufficient capacity
      .filter(pool => {
        const { initial, total } = poolCapacities[pool.poolId];
        return initial.add(amount).lte(total);
      })
      .map(pool => {
        // calculate premium for each pool
        const { poolId, basePrice } = pool;
        const { initial, total } = poolCapacities[poolId];
        const premium = calculatePremiumPerYear(amount, basePrice, initial, total);
        return { poolId, premium };
      })
      .reduce(
        // find the cheapest pool
        (cheapest, current) => (current.premium.lt(cheapest.premium) ? current : cheapest),
        { premium: MaxUint256, poolId: 0 },
      );

    const { poolId } = cheapestPool;

    if (poolId === 0) {
      // not enough total capacity available
      return [];
    }

    allocations[poolId] = allocations[poolId] ? allocations[poolId].add(amount) : amount;
    poolCapacities[poolId].initial = poolCapacities[poolId].initial.add(amount);
    unallocatedAmount = unallocatedAmount.sub(amount);
  }

  return Object.entries(allocations).map(([poolId, amount]) => ({ poolId, amount }));
};

module.exports = {
  calculateBasePrice,
  calculateFixedPricePremiumPerYear,
  calculatePremiumPerYear,
  calculateOptimalPoolAllocation,
};
