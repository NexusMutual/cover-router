const { BigNumber, ethers } = require('ethers');
const { bnMax, calculateTrancheId, divCeil } = require('./helpers');
const { selectAssetRate, selectProductPools, selectProduct } = require('../store/selectors');

const { MaxUint256, WeiPerEther, Zero } = ethers.constants;
const { formatEther, formatUnits } = ethers.utils;

const {
  NXM_PER_ALLOCATION_UNIT,
  ONE_YEAR,
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
  const totalSurgePremium = amountOnSurge.mul(amountOnSurge).mul(SURGE_PRICE_RATIO).div(totalCapacity).mul(2);
  const skipSurgePremium = amountOnSurgeSkip.mul(amountOnSurgeSkip).mul(SURGE_PRICE_RATIO).mul(totalCapacity).div(2);
  const surgePremium = totalSurgePremium.sub(skipSurgePremium);

  console.log('Cover amount   :', formatEther(coverAmount), 'nxm');
  console.log('Amount on surge:', formatEther(amountOnSurge), 'nxm');

  console.log('Base price     :', formatUnits(basePrice, 4), 'nxm');
  console.log('Base premium   :', formatEther(basePremium), 'nxm');
  console.log('Surge skipped  :', formatEther(skipSurgePremium), 'nxm');
  console.log('Surge premium  :', formatEther(surgePremium), 'nxm');

  return basePremium.add(surgePremium);
};

const quoteEngine = (store, productId, amount, period, coverAsset) => {
  const product = selectProduct(store, productId);
  const productPools = selectProductPools(store, productId);
  const assetRate = selectAssetRate(store, coverAsset);

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

  const zeroPool = {
    poolId: 0,
    premiumInNxm: MaxUint256,
    premiumInAsset: MaxUint256,
    coverAmountInNxm: MaxUint256,
    coverAmountInAsset: MaxUint256,
  };

  const poolsWithPremium = productPools.map(pool => {
    const { poolId, targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = pool;

    const totalCapacity = trancheCapacities
      .slice(firstUsableTrancheIndex)
      .reduce((total, capacity) => total.add(capacity), Zero)
      .mul(NXM_PER_ALLOCATION_UNIT);

    const initiallyUsedCapacity = allocations
      .slice(firstUsableTrancheIndex)
      .reduce((total, allocation) => total.add(allocation), Zero)
      .mul(NXM_PER_ALLOCATION_UNIT);

    console.log('Pool:', poolId);
    console.log('Initially used capacity:', formatEther(initiallyUsedCapacity), 'nxm');
    console.log('Total pool capacity    :', formatEther(totalCapacity), 'nxm');

    if (initiallyUsedCapacity.add(amountToAllocate).gt(totalCapacity)) {
      return { ...zeroPool, poolId };
    }

    // TODO: account for global min price
    const basePrice = product.useFixedPrice
      ? targetPrice
      : calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

    const premiumPerYear = product.useFixedPrice
      ? calculateFixedPricePremiumPerYear(amountToAllocate, basePrice)
      : calculatePremiumPerYear(amountToAllocate, basePrice, initiallyUsedCapacity, totalCapacity);

    const premiumInNxm = premiumPerYear.mul(period).div(ONE_YEAR);

    // TODO: use asset decimals instead of generic 18 decimals
    const premiumInAsset = premiumInNxm.mul(assetRate).div(WeiPerEther);

    return { poolId, premiumInNxm, premiumInAsset, coverAmountInNxm, coverAmountInAsset: amount };
  });

  // TODO: add support for multiple pools
  // routing via cheapest pool
  const cheapestPool = poolsWithPremium.reduce(
    (cheapest, current) => (current.premiumInNxm.lt(cheapest.premiumInNxm) ? current : cheapest),
    zeroPool,
  );

  if (cheapestPool.poolId === 0) {
    console.log('No pool has enough capacity');
    return [];
  }

  return [cheapestPool];
};

module.exports = quoteEngine;
