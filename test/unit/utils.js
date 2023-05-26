const { BigNumber, ethers } = require('ethers');
const { MaxUint256, WeiPerEther } = ethers.constants;

const { calculateFixedPricePremiumPerYear, calculatePremiumPerYear } = require('../../src/lib/quoteEngine');

const MIN_UNIT_SIZE = WeiPerEther;
const UNIT_DIVISOR = 10;
const getCombinations = (size, a) => {
  if (size === 1) {
    return a.map(i => [i]);
  }
  const combinations = [];

  for (let i = 0; i < a.length; i++) {
    const smallerCombinations = getCombinations(size - 1, a.slice(i + 1));

    for (const smallCombination of smallerCombinations) {
      combinations.push([a[i], ...smallCombination]);
    }
  }
  return combinations;
};
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
};

const calculateCost = (combination, amountSplit, UNIT_SIZE, useFixedPrice) => {
  let totalPremium = BigNumber.from(0);
  for (let i = 0; i < combination.length; i++) {
    const pool = combination[i];

    const amount = amountSplit[i];

    const amountInWei = BigNumber.from(amount).mul(UNIT_SIZE);

    const premium = useFixedPrice
      ? calculateFixedPricePremiumPerYear(amountInWei, pool.basePrice)
      : calculatePremiumPerYear(amountInWei, pool.basePrice, pool.initialCapacityUsed, pool.totalCapacity);

    totalPremium = totalPremium.add(premium);
  }

  return totalPremium;
};

/**
 *  Computes the optimal price by trying all combinations of pools and amount splits
 *  for each particular combination of pools.
 *
 * @param coverAmount
 * @param pools
 * @param useFixedPrice
 * @returns {{lowestCostAllocation: {}, lowestCost: *}}
 */
const calculateOptimalPoolAllocationBruteForce = (coverAmount, pools, useFixedPrice) => {
  // set UNIT_SIZE to be a minimum of 1.
  const UNIT_SIZE = coverAmount.div(UNIT_DIVISOR).gt(MIN_UNIT_SIZE) ? coverAmount.div(UNIT_DIVISOR) : MIN_UNIT_SIZE;

  const amountInUnits = coverAmount.div(UNIT_SIZE);

  let lowestCost = MaxUint256;
  let lowestCostAllocation;
  for (const splitCount of [1, 2, 3, 4, 5]) {
    const combinations = getCombinations(splitCount, pools);
    const amountSplits = getAmountSplits(splitCount, amountInUnits);

    for (const combination of combinations) {
      for (const amountSplit of amountSplits) {
        const cost = calculateCost(combination, amountSplit, UNIT_SIZE);

        if (cost.lt(lowestCost)) {
          lowestCost = cost;

          lowestCostAllocation = {};
          for (let i = 0; i < combination.length; i++) {
            const pool = combination[i];
            lowestCostAllocation[pool.poolId] = BigNumber.from(amountSplit[i]).mul(UNIT_SIZE);
          }
        }
      }
    }
  }

  return lowestCostAllocation;
};

module.exports = {
  calculateOptimalPoolAllocationBruteForce,
};
