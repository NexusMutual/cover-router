const { BigNumber, ethers } = require('ethers');
const { bnMax } = require('./helpers');

const { MaxUint256, WeiPerEther, Zero } = ethers.constants;
const { formatEther, formatUnits } = ethers.utils;


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

  // console.log('Cover amount   :', formatEther(coverAmount), 'nxm');
  // console.log('Amount on surge:', formatEther(amountOnSurge), 'nxm');
  //
  // console.log('Base price     :', formatUnits(basePrice, 4), 'nxm');
  // console.log('Base premium   :', formatEther(basePremium), 'nxm');
  // console.log('Surge skipped  :', formatEther(skipSurgePremium), 'nxm');
  // console.log('Surge premium  :', formatEther(surgePremium), 'nxm');

  return basePremium.add(surgePremium);
};



const getCombinations = (size, a) => {

  if (size === 1) {
    return a.map(i => [i]);
  }
  const combinations = [];

  for (let i = 0; i < a.length; i++) {
     const smallerCombinations = getCombinations(size - 1, a.slice(i + 1));

     for (const smallCombination of smallerCombinations) {
       combinations.push([a[i], ...smallCombination])   ;
     }
  }
  return combinations;
}


const getAmountSplits = (splitCount, amountInUnits) => {

  if (splitCount === 1) {
    return [[amountInUnits]];
  }

  const splits = [];
  for (let i = 0; i <= amountInUnits; i++) {

    const remainderAmount = amountInUnits - i;
    const restOfSplits = getAmountSplits(splitCount - 1, remainderAmount);
    for (const split of restOfSplits) {
      splits.push([i, ...split]);
    }

  }
  return splits;
}

const calculateCost = (combination, amountSplit) => {
  let totalPremium = BigNumber.from(0);
  for (let i = 0; i < combination.length; i++) {
    const pool = combination[i];

    const amount = amountSplit[i];

    const amountInWei = BigNumber.from(amount).mul(UNIT_SIZE);

    const premium = calculatePremiumPerYear(amountInWei, pool.basePrice, pool.initialCapacityUsed, pool.totalCapacity);

    totalPremium = totalPremium.add(premium);
  }

  return totalPremium;
}


/**
 * This function allocates each unit to the cheapest opportunity available for that unit
 * at that time given the allocations at the previous points.
 * Complexity O(n * p)  where n is the number of units in the amount and p is th  e number of pools
 * @param coverAmount
 * @param pools
 * @returns {{lowestCostAllocation: undefined, lowestCost: *}}
 */
const calculateOptimalPoolAllocationGreedy = (coverAmount, pools) => {

  // set UNIT_SIZE to be a minimum of 1.
  const UNIT_SIZE = coverAmount.div(UNIT_DIVISOR).gt(MIN_UNIT_SIZE)
    ? coverAmount.div(UNIT_DIVISOR) : MIN_UNIT_SIZE;
  const amountInUnits = coverAmount.div(UNIT_SIZE).toNumber();

  let lowestCost = BigNumber.from(0);
  let lowestCostAllocation = { };

  // by poolId
  const poolCapacityUsed = {};

  for (const pool of pools) {
    poolCapacityUsed[pool.poolId] = pool.initialCapacityUsed;
  }

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

      const premium = calculatePremiumPerYear(
        amountInWei, pool.basePrice, poolCapacityUsed[pool.poolId], pool.totalCapacity
      );

      if (premium.lt(lowestCostPerPool)) {
        lowestCostPerPool = premium;
        lowestCostPool = pool;
      }
    }

    lowestCost = lowestCost.add(lowestCostPerPool);

    if (!lowestCostAllocation[lowestCostPool.poolId]) {
      lowestCostAllocation[lowestCostPool.poolId] = BigNumber.from(0);
    }

    lowestCostAllocation[lowestCostPool.poolId] = lowestCostAllocation[lowestCostPool.poolId].add(UNIT_SIZE);

    poolCapacityUsed[lowestCostPool.poolId] = poolCapacityUsed[lowestCostPool.poolId].add(UNIT_SIZE);
  }

  return { lowestCostAllocation, lowestCost };
}

const calculateOptimalPoolAllocationBruteForce = (coverAmount, pools) => {

  // set UNIT_SIZE to be a minimum of 1.
  const UNIT_SIZE = coverAmount.div(UNIT_DIVISOR).gt(MIN_UNIT_SIZE)
    ? coverAmount.div(UNIT_DIVISOR) : MIN_UNIT_SIZE;

  const amountInUnits = coverAmount.div(UNIT_SIZE);

  let lowestCost = MaxUint256;
  let lowestCostAllocation;
  for (const splitCount of [1, 2]) {
    const combinations = getCombinations(splitCount, pools);


    const amountSplits = getAmountSplits(splitCount, amountInUnits);

    for (const combination of combinations) {
      for (const amountSplit of amountSplits) {
        const cost = calculateCost(combination, amountSplit);

        if (cost.lt(lowestCost)) {
          lowestCost = cost;

          lowestCostAllocation = {}
          for (let i = 0; i < combination.length; i++) {
            const pool = combination[i];
            lowestCostAllocation[pool.poolId] = BigNumber.from(amountSplit[i]).mul(UNIT_SIZE);
          }
        }
      }
    }
  }

  return { lowestCostAllocation, lowestCost };
}
const calculateOptimalPoolAllocation = (coverAmount, pools) => {
  return calculateOptimalPoolAllocationGreedy(coverAmount, pools);
}

module.exports = {
  calculateBasePrice,
  calculateFixedPricePremiumPerYear,
  calculatePremiumPerYear,
  calculateOptimalPoolAllocation,
  calculateOptimalPoolAllocationBruteForce
}