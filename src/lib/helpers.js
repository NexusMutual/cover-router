const ethers = require('ethers');

const {
  BUCKET_DURATION,
  NXM_PER_ALLOCATION_UNIT,
  TRANCHE_DURATION,
  TARGET_PRICE_DENOMINATOR,
  PRICE_CHANGE_PER_DAY,
  CAPACITY_BUFFER_RATIO,
  CAPACITY_BUFFER_DENOMINATOR,
  CAPACITY_BUFFER_MINIMUM,
} = require('./constants');

const { BigNumber } = ethers;
const { WeiPerEther, Zero } = ethers.constants;

/* Bignumber Utils */

const bnMax = (a, b) => (a.gt(b) ? a : b);
const bnMin = (a, b) => (a.lt(b) ? a : b);
const divCeil = (a, b) => a.div(b).add(a.mod(b).gt(0) ? 1 : 0);

/* Express Server Utils */

const asyncRoute = fn => (req, res, next) => {
  fn(req, res, next).catch(err => {
    console.error(err);
    res.status(500).send({ error: 'Internal Server Error', response: null });
  });
};

const promiseAllInBatches = async (task, items, concurrency) => {
  const itemsClone = [...items];
  const results = [];
  while (itemsClone.length) {
    const itemsForBatch = itemsClone.splice(0, concurrency);
    const newItems = await Promise.all(itemsForBatch.map(item => task(item)));
    results.push(...newItems);
  }
  return results;
};

/* Tranche & Bucket Calculations */

const calculateTrancheId = time => {
  const timeNumber = BigNumber.isBigNumber(time) ? time.toNumber() : time;
  return Math.floor(timeNumber / TRANCHE_DURATION);
};

const calculateBucketId = time => {
  const timeNumber = BigNumber.isBigNumber(time) ? time.toNumber() : time;
  return Math.floor(timeNumber / BUCKET_DURATION);
};

/**
 * Calculates the first usable tranche index based on the current time, grace period, and period.
 *
 * @param {BigNumber|number} now - The current unix timestamp seconds as a BigNumber or native JS number.
 * @param {BigNumber|number} gracePeriod - The grace period of the product in seconds
 * @param {BigNumber|number} period - The cover period in seconds
 * @returns {number} The index of the first usable tranche.
 */
const calculateFirstUsableTrancheIndex = (now, gracePeriod, period) => {
  const nowBigNumber = BigNumber.isBigNumber(now) ? now : BigNumber.from(now);
  const gracePeriodExpiration = nowBigNumber.add(gracePeriod).add(period);
  const firstActiveTrancheId = calculateTrancheId(now);
  const firstUsableTrancheId = calculateTrancheId(gracePeriodExpiration);
  return firstUsableTrancheId - firstActiveTrancheId;
};

/* Capacity Calculations */

const bufferedCapacity = capacityInNxm => {
  const capacityBuffer = bnMax(
    capacityInNxm.mul(CAPACITY_BUFFER_RATIO).div(CAPACITY_BUFFER_DENOMINATOR),
    CAPACITY_BUFFER_MINIMUM,
  );
  return bnMax(capacityInNxm.sub(capacityBuffer), Zero);
};

/**
 * Calculates the available capacity in NXM across all trancehs.
 * Buffer is applied because using capacity up to the limit may lead to reverted transactions
 * in the cases of small price changes of cover assets.
 *
 * @param {Array<BigNumber>} trancheCapacities - An array of tranche capacities
 * @param {Array<BigNumber>} allocations - An array of allocated amounts corresponding to each tranche
 * @param {number} firstUsableTrancheIndex - The index of the first usable tranche
 * @returns {BigNumber} The available capacity in NXM, adjusted with buffering
 */
function calculateAvailableCapacityInNXM(trancheCapacities, allocations, firstUsableTrancheIndex) {
  const unused = trancheCapacities.reduce((available, capacity, index) => {
    const allocationDifference = capacity.sub(allocations[index]);
    const allocationToAdd =
      index < firstUsableTrancheIndex
        ? bnMin(allocationDifference, Zero) // only carry over the negative
        : allocationDifference;
    return available.add(allocationToAdd);
  }, Zero);

  return bufferedCapacity(unused.mul(NXM_PER_ALLOCATION_UNIT));
}

function getCapacitiesInAssets(capacityInNXM, assets, assetRates) {
  return Object.keys(assets).map(assetId => ({
    assetId: Number(assetId),
    amount: capacityInNXM.mul(assetRates[assetId]).div(WeiPerEther),
    asset: assets[assetId],
  }));
}

function calculateProductDataForTranche(productPools, firstUsableTrancheIndex, useFixedPrice, now, assets, assetRates) {
  const aggregatedData = {
    capacityUsedNXM: Zero,
    capacityAvailableNXM: Zero,
    minPrice: Zero,
    totalPremium: Zero,
  };

  const capacityPerPool = productPools.map(pool => {
    const { allocations, trancheCapacities, targetPrice, bumpedPrice, bumpedPriceUpdateTime, poolId } = pool;

    // Validate data integrity
    if (!allocations || !trancheCapacities) {
      throw new Error('Pool data integrity error: missing allocations or trancheCapacities');
    }

    if (allocations.length !== trancheCapacities.length) {
      throw new Error('Pool data integrity error: allocations length must match trancheCapacities length');
    }

    // calculating the capacity in allocation points
    const used = allocations.reduce((total, allocation) => total.add(allocation), Zero);

    const availableCapacityInNXM = calculateAvailableCapacityInNXM(
      trancheCapacities,
      allocations,
      firstUsableTrancheIndex,
    );

    // convert to nxm
    const usedInNXM = used.mul(NXM_PER_ALLOCATION_UNIT);

    aggregatedData.capacityUsedNXM = aggregatedData.capacityUsedNXM.add(usedInNXM);
    aggregatedData.capacityAvailableNXM = aggregatedData.capacityAvailableNXM.add(availableCapacityInNXM);

    if (availableCapacityInNXM.isZero()) {
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

    const poolMinPrice = WeiPerEther.mul(basePrice).div(TARGET_PRICE_DENOMINATOR);

    // the maximum price a user would get can only be determined if the entire available
    // capacity is bought because the routing will always pick the cheapest
    // so we're summing up the premium for all pools and then calculate the average at the end
    const poolPremium = calculatePremiumPerYear(availableCapacityInNXM, basePrice);

    const poolMaxPrice = availableCapacityInNXM.isZero()
      ? Zero
      : WeiPerEther.mul(poolPremium).div(availableCapacityInNXM);

    if (aggregatedData.minPrice.isZero() || poolMinPrice.lt(aggregatedData.minPrice)) {
      aggregatedData.minPrice = poolMinPrice;
    }
    aggregatedData.totalPremium = aggregatedData.totalPremium.add(poolPremium);

    // The available capacity of a product for a particular pool
    const availableCapacityInAssets = getCapacitiesInAssets(availableCapacityInNXM, assets, assetRates);

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

/* Price Calculations */

const calculateBasePrice = (targetPrice, bumpedPrice, bumpedPriceUpdateTime, now) => {
  if (!targetPrice) {
    throw new Error('Target price is required');
  }
  // If bumped price data is incomplete, return target price
  if (!bumpedPrice || !bumpedPriceUpdateTime) {
    return targetPrice;
  }

  const elapsed = now.sub(bumpedPriceUpdateTime);
  const priceDrop = elapsed.mul(PRICE_CHANGE_PER_DAY).div(3600 * 24);
  return bnMax(targetPrice, bumpedPrice.sub(priceDrop));
};

const calculatePremiumPerYear = (coverAmount, basePrice) => {
  return coverAmount.mul(basePrice).div(TARGET_PRICE_DENOMINATOR);
};

module.exports = {
  bnMax,
  bnMin,
  divCeil,
  asyncRoute,
  promiseAllInBatches,
  calculateTrancheId,
  calculateBucketId,
  calculateFirstUsableTrancheIndex,
  bufferedCapacity,
  calculateAvailableCapacityInNXM,
  getCapacitiesInAssets,
  calculateProductDataForTranche,
  calculateBasePrice,
  calculatePremiumPerYear,
};
