const { BigNumber, ethers } = require('ethers');

const { NXM_PER_ALLOCATION_UNIT, ONE_YEAR, TARGET_PRICE_DENOMINATOR, HTTP_STATUS } = require('./constants');
const { ApiError } = require('./error');
const {
  calculateFirstUsableTrancheIndex,
  calculateBasePrice,
  calculatePremiumPerYear,
  calculateAvailableCapacityInNXM,
  getCapacitiesInAssets,
  getCoverTrancheAllocations,
  calculateCoverRefundInNXM,
  divCeil,
  bnMin,
} = require('./helpers');
const {
  selectAssetRate,
  selectCover,
  selectProductPools,
  selectProduct,
  selectProductPriorityPoolsFixedPrice,
} = require('../store/selectors');

const { WeiPerEther, Zero } = ethers.constants;
const { formatEther } = ethers.utils;

/**
 * This function allocates the requested amount in the provided list of pools in the provided order.
 * Empty array is returned if not enough capacity is available.
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
      poolId: pool.poolId,
      amount: bnMin(pool.availableCapacityInNXM, coverAmountLeft),
    };

    coverAmountLeft = coverAmountLeft.sub(allocation.amount);
    allocations.push(allocation);

    if (coverAmountLeft.eq(0)) {
      break;
    }
  }

  if (coverAmountLeft.gt(0)) {
    // not enough total capacity available
    throw new ApiError('Not enough capacity for the cover amount', HTTP_STATUS.BAD_REQUEST);
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

function getLatestCover(store, originalCoverId) {
  const originalCover = selectCover(store, originalCoverId);

  if (originalCover.originalCoverId !== originalCoverId) {
    throw new ApiError('Not original cover id', HTTP_STATUS.BAD_REQUEST);
  }

  return originalCover.latestCoverId === originalCoverId
    ? originalCover
    : selectCover(store, originalCover.latestCoverId);
}

function calculateAnualPrice(premiumInAsset, period, coverAmountInAsset) {
  return premiumInAsset
    .mul(365 * 24 * 3600)
    .mul(TARGET_PRICE_DENOMINATOR)
    .div(period)
    .div(coverAmountInAsset);
}

/**
 * Calculates the premium and allocations for a given insurance product based on the specified parameters.
 *
 * @param {object} store - The application state store.
 * @param {number} productId - The ID of the product to quote.
 * @param {BigNumber} amount - The amount of coverage requested.
 * @param {number} period - The cover period in seconds.
 * @param {string} coverAsset - The assetId of the asset to be covered.
 * @param {number} editedCoverId - The ID of the cover which is edited. ID is 0 when getting quote for new cover.
 * @returns {Array<object>} - An array of objects containing pool allocations and premiums.
 */
const quoteEngine = (store, productId, amount, period, coverAsset, editedCoverId = 0) => {
  const product = selectProduct(store, productId);

  if (!product) {
    throw new ApiError('Invalid Product Id', HTTP_STATUS.BAD_REQUEST);
  }

  if (product.isDeprecated) {
    throw new ApiError('Product is deprecated', HTTP_STATUS.BAD_REQUEST);
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

  const cover = editedCoverId !== 0 ? getLatestCover(store, editedCoverId) : undefined;

  const poolsData = productPools.map(pool => {
    const { poolId, targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = pool;

    const availableCapacityInNXM = calculateAvailableCapacityInNXM(
      trancheCapacities,
      allocations,
      firstUsableTrancheIndex,
      cover ? getCoverTrancheAllocations(cover, poolId, now) : [],
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
    const pool = poolsData.find(data => allocation.poolId === data.poolId);
    const premiumPerYear = calculatePremiumPerYear(allocation.amount, pool.basePrice);

    const premiumInNxm = premiumPerYear.mul(period).div(ONE_YEAR);
    const premiumInAsset = premiumInNxm.mul(assetRate).div(WeiPerEther);

    const coverAmountInAsset = allocation.amount.mul(assetRate).div(WeiPerEther);

    const capacities = {
      poolId: pool.poolId,
      capacity: getCapacitiesInAssets(pool.availableCapacityInNXM, assets, assetRates),
    };

    console.info('Pool:', pool.poolId);
    console.info('Available pool capacity:', formatEther(pool.availableCapacityInNXM), 'nxm');

    return {
      poolId: pool.poolId,
      premiumInNxm,
      premiumInAsset,
      coverAmountInNxm: allocation.amount,
      coverAmountInAsset,
      capacities,
    };
  });

  const totals = poolsWithPremium.reduce(
    (totals, pool) => {
      return {
        coverAmountInAsset: totals.coverAmountInAsset.add(pool.coverAmountInAsset),
        premiumInNXM: totals.premiumInNXM.add(pool.premiumInNxm),
        premiumInAsset: totals.premiumInAsset.add(pool.premiumInAsset),
      };
    },
    {
      premiumInNXM: Zero,
      premiumInAsset: Zero,
      coverAmountInAsset: Zero,
    },
  );

  const capacities = poolsWithPremium.reduce((capacities, pool) => {
    return [...capacities, pool.capacities];
  }, []);

  // calculate refund for the edited cover
  const refundInNXM = editedCoverId !== 0 ? calculateCoverRefundInNXM(cover, now) : Zero;
  const refundInAsset = refundInNXM.mul(assetRate).div(WeiPerEther);

  const totalPremiumInNXMWithRefund = totals.premiumInNXM.sub(refundInNXM);
  const totalPremiumInAssetWithRefund = totals.premiumInAsset.sub(refundInAsset);

  const quoteTotals = {
    ...totals,
    premiumInNXM: totalPremiumInNXMWithRefund.gt(0) ? totalPremiumInNXMWithRefund : Zero,
    premiumInAsset: totalPremiumInAssetWithRefund.gt(0) ? totalPremiumInAssetWithRefund : Zero,
    annualPrice: totalPremiumInAssetWithRefund.gt(0)
      ? calculateAnualPrice(totalPremiumInAssetWithRefund, period, totals.coverAmountInAsset)
      : Zero,
  };

  return { poolsWithPremium, capacities, refundInNXM, refundInAsset, quoteTotals };
};

module.exports = {
  quoteEngine,
  calculateBasePrice,
  calculatePremiumPerYear,
  calculatePoolAllocations,
};
