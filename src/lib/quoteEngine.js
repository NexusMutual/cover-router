const { BigNumber, ethers } = require('ethers');
const { calculateTrancheId, divCeil } = require('./helpers');
const { selectAssetRate, selectProductPools, selectProduct, selectCover } = require('../store/selectors');
const { WeiPerEther, Zero, MaxUint256 } = ethers.constants;
const { formatEther, parseEther } = ethers.utils;

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
  UNIT_DIVISOR,
  ONE_NXM,
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

const calculatePremium = (coverAmount, basePrice, initialCapacityUsed, totalCapacity, period, useFixedPrice) => {

  const premiumPerYear = useFixedPrice
    ? calculateFixedPricePremiumPerYear(coverAmount, basePrice)
    : calculatePremiumPerYear(coverAmount, basePrice, initialCapacityUsed, totalCapacity);
  return premiumPerYear.mul(period).div(365 * 24 * 3600);
}
const getNXMForAssetAmount = (amountInCoverAsset, nxmPriceInCoverAsset) => {

  const nxmAmount = amountInCoverAsset.mul(parseEther('1')).div(nxmPriceInCoverAsset);

  const coverNXMAmount = nxmAmount.mod(NXM_PER_ALLOCATION_UNIT).eq(0)
    ? nxmAmount
    : nxmAmount.div(NXM_PER_ALLOCATION_UNIT).add(1).mul(NXM_PER_ALLOCATION_UNIT);

  return coverNXMAmount;
}

const calculatePreviousAllocationsRepriced = async (
  previousSegmentAmount,
  previousSegmentAllocations,
  nxmPriceInCoverAsset) => {

  let previousTotalCoverAmountInNXM = BigNumber.from(0);
  for (const allocation of Object.values(previousSegmentAllocations)) {
    previousTotalCoverAmountInNXM = previousTotalCoverAmountInNXM.add(allocation.coverAmountInNXM);
  }

  const previousCoverAmountInNXMRepriced = getNXMForAssetAmount(
    previousSegmentAmount, nxmPriceInCoverAsset
  );

  const previousAllocationsRepriced = {};

  for (const poolId of Object.keys(previousSegmentAllocations)) {

    const allocation = previousSegmentAllocations[poolId];
    const previousAllocationRepriced =
      allocation.coverAmountInNXM.mul(previousCoverAmountInNXMRepriced).div(previousTotalCoverAmountInNXM);

    previousAllocationsRepriced[poolId] = previousAllocationRepriced;
  }

  return previousAllocationsRepriced;
}

function getPremium(
  amountToAllocate,
  period,
  extraPeriod,
  basePrice,
  initialCapacityUsed,
  totalCapacity,
  previousAllocationAmountRepriced,
  useFixedPrice) {
  const totalPremium = calculatePremium(
    amountToAllocate,
    basePrice,
    initialCapacityUsed,
    totalCapacity,
    period,
    useFixedPrice,
  );

  const remainingPeriod = period.sub(extraPeriod);

  const extraAmount = amountToAllocate.gt(previousAllocationAmountRepriced)
    ? amountToAllocate.sub(previousAllocationAmountRepriced)
    : 0;

  const premium = totalPremium
    .mul(extraAmount)
    .mul(remainingPeriod)
    .div(period)
    .div(amountToAllocate)
    .add(totalPremium.mul(extraPeriod).div(period));

  return premium;
}

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
 * @param nxmPriceInCoverAsset
 * @param period
 * @param lastSegment
 * @returns {{lowestCostAllocation: *, lowestCost: *}}
 */
const calculateOptimalPoolAllocation = (
  coverAmount,
  pools,
  minUnitSize,
  useFixedPrice,
  nxmPriceInCoverAsset,
  period,
  lastSegment
  ) => {

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

  let previousAllocationsRepriced = {};
  let extraPeriod = BigNumber.from(0);

  // if this is an edit
  if (lastSegment) {

    const now  = new Date().getTime() / 1000;
    const remainingPeriod = lastSegment.start.add(lastSegment.period).sub(now);
    period = remainingPeriod.add(period);
    // when editing a cover the new period is the remaining period + the requested period
    extraPeriod = period;

    previousAllocationsRepriced = calculatePreviousAllocationsRepriced(
      lastSegment.amount,
      lastSegment.allocations,
      nxmPriceInCoverAsset
    );
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

      const premium = getPremium(
        amountToAllocate,
        period,
        extraPeriod,
        pool.basePrice,
        poolCapacityUsed[pool.poolId],
        pool.totalCapacity,
        previousAllocationsRepriced[pool.poolId] || BigNumber.from(0),
        useFixedPrice
      );

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

const quoteEngine = async (store, productId, amount, period, coverAsset, coverId) => {
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

  const cover = selectCover(store, coverId);
  const lastSegmentAllocations = cover ? cover.lastSegmentAllocations : {};

  const productPools = selectProductPools(store, productId);
  const nxmPriceInCoverAsset = selectAssetRate(store, coverAsset);
  const assetRates = store.getState().assetRates;

  const now = BigNumber.from(Date.now()).div(1000);
  const gracePeriodExpiration = now.add(period).add(product.gracePeriod);

  const firstActiveTrancheId = calculateTrancheId(now);
  const firstUsableTrancheId = calculateTrancheId(gracePeriodExpiration);
  const firstUsableTrancheIndex = firstUsableTrancheId - firstActiveTrancheId;

  // TODO: use asset decimals instead of generic 18 decimals
  const coverAmountInNxm = amount.mul(WeiPerEther).div(nxmPriceInCoverAsset);

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
  const minUnitSizeInNxm = MIN_UNIT_SIZE_DAI.mul(WeiPerEther).div(daiRate);

  const lastSegment = cover ? { ...cover.segments[cover.segments.length], allocations: lastSegmentAllocations } : {};

  const allocations = calculateOptimalPoolAllocation(
    amountToAllocate,
    poolsData,
    minUnitSizeInNxm,
    product.useFixedPrice,
    nxmPriceInCoverAsset,
    period,
    lastSegment
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
    const premiumInAsset = premiumInNxm.mul(nxmPriceInCoverAsset).div(WeiPerEther);

    const capacityInNxm = pool.totalCapacity.sub(pool.initialCapacityUsed);
    const capacity = Object.entries(assetRates).map(([assetId, rate]) => ({
      assetId,
      amount: capacityInNxm.mul(rate).div(WeiPerEther),
    }));

    console.log('Pool:', poolId);
    console.log('Initially used capacity:', formatEther(pool.initialCapacityUsed), 'nxm');
    console.log('Total pool capacity    :', formatEther(pool.totalCapacity), 'nxm');
    console.log('Pool capacity          :', formatEther(capacityInNxm), 'nxm');

    const coverAmountInAsset = amountToAllocate.mul(nxmPriceInCoverAsset).div(WeiPerEther);

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
  calculateFixedPricePremiumPerYear,
  calculatePremiumPerYear,
  calculateOptimalPoolAllocation,
  calculatePreviousCoverAmountsRepriced: calculatePreviousAllocationsRepriced
};
