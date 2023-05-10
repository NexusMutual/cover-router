const { BigNumber, ethers } = require('ethers');
const { calculateTrancheId, divCeil } = require('./helpers');
const { selectAssetRate, selectProductPools, selectProduct } = require('../store/selectors');

const { MaxUint256, WeiPerEther, Zero } = ethers.constants;
const { formatEther } = ethers.utils;

const {
  NXM_PER_ALLOCATION_UNIT,
  ONE_YEAR,
} = require('./constants');

const { calculateBasePrice, calculateFixedPricePremiumPerYear, calculatePremiumPerYear } = require('premium-computations');

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

    const capacityInNxm = totalCapacity.sub(initiallyUsedCapacity);
    const capacity = Object.entries(assetRates).map(([assetId, rate]) => ({
      assetId,
      amount: capacityInNxm.mul(rate).div(WeiPerEther),
    }));

    console.log('Pool:', poolId);
    console.log('Initially used capacity:', formatEther(initiallyUsedCapacity), 'nxm');
    console.log('Total pool capacity    :', formatEther(totalCapacity), 'nxm');
    console.log('Pool capacity          :', formatEther(capacityInNxm), 'nxm');

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

    return {
      poolId,
      premiumInNxm,
      premiumInAsset,
      coverAmountInNxm,
      coverAmountInAsset: amount,
      capacities: { poolId, capacity },
    };
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
