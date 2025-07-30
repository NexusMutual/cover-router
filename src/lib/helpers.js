const { inspect } = require('node:util');

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
  MAX_ACTIVE_TRANCHES,
  HTTP_STATUS,
} = require('./constants');
const { ApiError } = require('./error');
const { selectCover } = require('../store/selectors');

const { BigNumber } = ethers;
const { WeiPerEther, Zero } = ethers.constants;

/* Bignumber Utils */

const bnMax = (a, b) => (a.gt(b) ? a : b);
const bnMin = (a, b) => (a.lt(b) ? a : b);
const divCeil = (a, b) => a.div(b).add(a.mod(b).gt(0) ? 1 : 0);

/* Express Server Utils */

const DEFAULT_ERROR = { message: 'Internal Server Error', statusCode: HTTP_STATUS.SERVER_ERROR };

/**
 * Creates an asynchronous route handler by wrapping the given function.
 *
 * In case of a successful Promise resolution, the response will be sent as a JSON object.
 * In case of a Promise rejection, an error response will be sent with appropriate HTTP status.
 *
 * @param {Function} fn - async function that takes in the request object and returns a Promise.
 * @returns route handler callback that takes in the request and response objects
 */
const asyncRoute = fn => (req, res) => {
  console.debug(`Request.body: `, inspect(req.body, { depth: null }));
  fn(req)
    .then(response => {
      console.debug(`Response:\n`, inspect(response, { depth: null }));

      res.status(response.statusCode || HTTP_STATUS.OK).json(response.body);
    })
    .catch(err => {
      console.error('Error caught: ', err);

      const { message, statusCode, data } = err instanceof ApiError ? err : DEFAULT_ERROR;
      const body = data ?? { message };

      console.debug(`Response:\n`, inspect({ statusCode, body }, { depth: null }));
      res.status(statusCode).send(body);
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
 * @param {Array<BigNumber>} coverAllocations - An array of allocated amounts in each tranche for edited cover
 * @returns {BigNumber} The available capacity in NXM, adjusted with buffering
 */
function calculateAvailableCapacityInNXM(
  trancheCapacities,
  allocations,
  firstUsableTrancheIndex,
  coverAllocations = [],
) {
  const unused = trancheCapacities.reduce((available, capacity, index) => {
    const allocationDifference = capacity
      .sub(allocations[index])
      .add(index < coverAllocations.length ? coverAllocations[index] : 0); // add amount that will be deallocated

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

function calculateProductDataForTranche(
  productPools,
  firstUsableTrancheIndex,
  useFixedPrice,
  now,
  assets,
  assetRates,
  editedCover = null,
) {
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
      editedCover ? getCoverTrancheAllocations(editedCover, poolId, now) : [],
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

/* Cover Calculations */

const getCoverTrancheAllocations = (cover, poolId, now) => {
  const packedTrancheAllocations = cover.poolAllocations.find(p => p.poolId === poolId)?.packedTrancheAllocations;
  if (!packedTrancheAllocations) {
    return [];
  }

  const bitmask32 = ethers.BigNumber.from('0xFFFFFFFF');
  const firstActiveTrancheId = calculateTrancheId(now);
  const offset = firstActiveTrancheId - Math.floor(cover.start / TRANCHE_DURATION);

  const coverTrancheAllocations = [];
  for (let i = offset; i < MAX_ACTIVE_TRANCHES; i++) {
    const allocation = packedTrancheAllocations.shr(i * 32).and(bitmask32);
    coverTrancheAllocations.push(allocation);
  }

  return coverTrancheAllocations;
};

const calculateCoverRefundInNXM = (cover, now) => {
  const totalPremiumInNXM = cover.poolAllocations.reduce((total, allocation) => {
    return total.add(allocation.premiumInNXM);
  }, Zero);
  return totalPremiumInNXM.mul(cover.start + cover.period - now.toNumber()).div(cover.period);
};

function getLatestCover(store, originalCoverId) {
  if (originalCoverId === 0) {
    return undefined;
  }

  const originalCover = selectCover(store, originalCoverId);

  if (originalCover.originalCoverId !== originalCoverId) {
    throw new ApiError('Not original cover id', HTTP_STATUS.BAD_REQUEST);
  }

  return originalCover.latestCoverId === originalCoverId
    ? originalCover
    : selectCover(store, originalCover.latestCoverId);
}

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
  getCoverTrancheAllocations,
  calculateCoverRefundInNXM,
  getLatestCover,
};
