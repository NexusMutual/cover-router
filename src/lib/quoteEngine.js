const { BigNumber, ethers } = require('ethers');

const {
  NXM_PER_ALLOCATION_UNIT,
  ONE_YEAR,
  TARGET_PRICE_DENOMINATOR,
  RI_THRESHOLD,
  RI_MIN_COVER_AMOUNT,
  RI_COVER_AMOUNT_PERCENTAGE,
  RI_COVER_AMOUNT_DENOMINATOR,
  RI_EPOCH_DURATION,
  SYMBIOTIC_PROVIDER_ID,
  HTTP_STATUS,
} = require('./constants');
const { ApiError } = require('./error');
const {
  calculateFirstUsableTrancheIndex,
  calculateBasePrice,
  calculatePremiumPerYear,
  calculateAvailableCapacityInNXM,
  getCoverTrancheAllocations,
  calculateCoverRefundInNXM,
  divCeil,
  bnMin,
  getLatestCover,
} = require('./helpers');
const {
  selectAssetRate,
  selectProductPools,
  selectProduct,
  selectProductPriorityPoolsFixedPrice,
  selectVaultProducts,
  selectRiAssetRate,
  selectActiveCoverAmount,
  selectVaultEpochExpiryTimestamp,
  selectRiCoverAmountPercentage,
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

function calculateAnualPrice(premiumInAsset, period, coverAmountInAsset) {
  return premiumInAsset
    .mul(365 * 24 * 3600)
    .mul(TARGET_PRICE_DENOMINATOR)
    .div(period)
    .div(coverAmountInAsset)
    .add(1); // add one as a round up to the second decimal for better precision
}

function calculateVaultCapacity(store, vault, now, coverId = 0) {
  // assetRate from staked token to NXM
  const assetRate = selectRiAssetRate(store, vault.asset);
  if (!assetRate) {
    return BigNumber.from(0);
  }
  const allocatedAmount = (vault.allocations || []).reduce((acc, allocation) => {
    // cover edit allocation
    const expiryTimestamp = BigNumber.isBigNumber(allocation.expiryTimestamp)
      ? allocation.expiryTimestamp
      : BigNumber.from(allocation.expiryTimestamp || 0);
    const allocationAmount = BigNumber.isBigNumber(allocation.amount)
      ? allocation.amount
      : BigNumber.from(allocation.amount || 0);
    if (expiryTimestamp.gt(now) && allocation.coverId !== coverId && allocation.active) {
      acc = acc.add(allocationAmount);
    }
    return acc;
  }, BigNumber.from(0));

  // All values are in vault asset units: activeStake, withdrawalAmount, and allocatedAmount
  // Convert to NXM at the end
  const activeStake = BigNumber.isBigNumber(vault.activeStake)
    ? vault.activeStake
    : BigNumber.from(vault.activeStake || 0);
  const withdrawalAmount = BigNumber.isBigNumber(vault.withdrawalAmount)
    ? vault.withdrawalAmount
    : BigNumber.from(vault.withdrawalAmount || 0);
  const availableCapacityInAsset = activeStake.add(withdrawalAmount).sub(allocatedAmount);
  return availableCapacityInAsset.mul(assetRate).div(WeiPerEther);
}

/**
 * Calculates the refund premium for RI (Reinsurance) allocations when a cover is being edited.
 * The refund is calculated based on the remaining period of the cover.
 *
 * @param {object} store - The application state store.
 * @param {object} product - The product object.
 * @param {object} cover - The cover being edited (must have coverId, start, and period).
 * @param {BigNumber} now - The current timestamp in seconds.
 * @param {number} paymentAsset - The assetId of the asset used for payment.
 * @returns {BigNumber} - The total refund premium in payment asset, or Zero if no refund.
 */
function calculateRiRefundInPaymentAsset(store, product, cover, now, paymentAsset) {
  if (!cover || !cover.coverId) {
    return Zero;
  }

  const paymentAssetRate = selectAssetRate(store, paymentAsset);
  const coverStart = BigNumber.isBigNumber(cover.start) ? cover.start : BigNumber.from(cover.start);
  const coverPeriod = BigNumber.isBigNumber(cover.period) ? cover.period : BigNumber.from(cover.period);
  const remainingPeriod = coverStart.add(coverPeriod).sub(now);

  if (remainingPeriod.lte(0)) {
    return Zero;
  }

  const vaults = selectVaultProducts(store, product.productId);
  let totalRefundInPaymentAsset = Zero;
  const nowNumber = BigNumber.isBigNumber(now) ? now.toNumber() : now;

  for (const vault of vaults) {
    if (!vault || !vault.allocations) {
      continue;
    }

    // Find allocations for this cover that are still active
    const coverAllocations = vault.allocations.filter(
      allocation => allocation.coverId === cover.coverId && allocation.expiryTimestamp > nowNumber && allocation.active,
    );

    for (const allocation of coverAllocations) {
      // Convert allocation amount from vault asset to NXM
      const riAssetRate = selectRiAssetRate(store, vault.asset);
      const allocationAmountInNXM = allocation.amount.mul(riAssetRate).div(WeiPerEther);

      // Calculate the original premium that was paid for this existing allocation
      const premiumInNXM = allocationAmountInNXM
        .mul(vault.price)
        .mul(coverPeriod)
        .div(ONE_YEAR)
        .div(TARGET_PRICE_DENOMINATOR);

      // Calculate refund based on remaining period
      const refundInNXM = premiumInNXM.mul(remainingPeriod).div(coverPeriod);

      // Convert refund to payment asset
      const refundForAllocation = refundInNXM.mul(paymentAssetRate).div(WeiPerEther);
      totalRefundInPaymentAsset = totalRefundInPaymentAsset.add(refundForAllocation);
    }
  }

  return totalRefundInPaymentAsset;
}

function calculateRiQuote(store, product, period, amountInNXM, now, paymentAsset, cover) {
  if (amountInNXM.eq(0)) {
    return null;
  }

  const paymentAssetRate = selectAssetRate(store, paymentAsset);
  const expiries = selectVaultEpochExpiryTimestamp(store); // timestamps of current epoch expiration
  const coverExpiry = now.add(product.gracePeriod).add(period);
  const epochDuration = RI_EPOCH_DURATION * 24 * 3600;

  let totalAvailableCapacity = BigNumber.from(0);

  const allVaults = selectVaultProducts(store, product.id);
  if (!allVaults || !Array.isArray(allVaults) || allVaults.length === 0) {
    return null;
  }
  // Filter out null/undefined vaults
  const validVaults = allVaults.filter(v => v != null);
  if (validVaults.length === 0) {
    return null;
  }
  const epochDurationBN = BigNumber.from(epochDuration);
  const vaults = validVaults
    .filter(vault => {
      if (!vault || !vault.vaultId) {
        return false;
      }
      const expiry = expiries[vault.vaultId];
      if (!expiry) {
        return false;
      }
      const expiryBigNumber = BigNumber.isBigNumber(expiry) ? expiry : BigNumber.from(expiry);
      const expiryWithDuration = expiryBigNumber.add(epochDurationBN);
      return expiryWithDuration.gt(coverExpiry);
    })
    .map(vault => {
      const availableCapacityInNXM = calculateVaultCapacity(store, vault, now, cover?.coverId || 0);
      totalAvailableCapacity = totalAvailableCapacity.add(availableCapacityInNXM);
      return {
        ...vault,
        availableCapacityInNXM,
      };
    })
    .sort((a, b) => a.availableCapacityInNXM.sub(b.availableCapacityInNXM).toNumber());

  if (totalAvailableCapacity.lt(amountInNXM)) {
    return null;
  }

  const riRequest = {
    providerId: SYMBIOTIC_PROVIDER_ID,
    amount: amountInNXM, // @TODO: change to coverAsset
    premium: BigNumber.from(0),
    data: [], // { amount: riAmount, riPoolId: 1, providerId: riProviderId }
    dataFormat: 1,
    deadline: now.add(2 * 24 * 3600).toNumber(),
  };

  let vaultsCount = vaults.length;
  let totalAmountToAllocate = BigNumber.from(amountInNXM);
  let amountPerVault = totalAmountToAllocate.div(vaultsCount);
  let remainder = totalAmountToAllocate.mod(vaultsCount);

  // Calculate refund premium if cover is being edited
  const totalRefundInPaymentAsset = calculateRiRefundInPaymentAsset(store, product, cover, now, paymentAsset);

  for (const vault of vaults) {
    if (vault.availableCapacityInNXM.lte(0)) {
      vaultsCount--;
      amountPerVault = totalAmountToAllocate.div(vaultsCount);
      remainder = totalAmountToAllocate.mod(vaultsCount);
      continue;
    }

    let allocationAmount = amountPerVault;
    const riAssetRate = selectRiAssetRate(store, vault.asset);

    if (vault.availableCapacityInNXM.lt(amountPerVault)) {
      allocationAmount = vault.availableCapacityInNXM;
      vaultsCount--;
      totalAmountToAllocate = totalAmountToAllocate.sub(allocationAmount);
      amountPerVault = totalAmountToAllocate.div(vaultsCount);
      remainder = totalAmountToAllocate.mod(vaultsCount);
    } else if (remainder.gt(0)) {
      // add 1 to the allocation amount to cover the remainder
      allocationAmount = allocationAmount.add(1);
      remainder = remainder.sub(1);
    }

    const premiumInNXM = allocationAmount.mul(vault.price).mul(period).div(ONE_YEAR).div(TARGET_PRICE_DENOMINATOR);
    const premiumInPaymentAsset = premiumInNXM.mul(paymentAssetRate).div(WeiPerEther);

    riRequest.premium = riRequest.premium.add(premiumInPaymentAsset);
    riRequest.data.push({
      amount: allocationAmount.mul(riAssetRate).div(WeiPerEther),
      riVaultId: vault.id,
      providerId: vault.providerId,
    });
  }

  // Subtract total refund from premium (ensure premium doesn't go negative)
  const premiumAfterRefund = riRequest.premium.sub(totalRefundInPaymentAsset);
  riRequest.premium = premiumAfterRefund.gt(0) ? premiumAfterRefund : BigNumber.from(0);

  return riRequest;
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
 * @param {number} paymentAsset - The assetId of the asset to be used for payment.
 * @param {boolean} useRiVaults - Whether to use RI vaults for the quote.
 * @returns {Array<object>} - An array of objects containing pool allocations and premiums.
 */
const quoteEngine = (store, productId, amount, period, coverAsset, editedCoverId = 0, paymentAsset, useRiVaults) => {
  const product = selectProduct(store, productId);

  if (!product) {
    throw new ApiError('Invalid Product Id', HTTP_STATUS.BAD_REQUEST);
  }

  if (product.isDeprecated) {
    throw new ApiError('Product is deprecated', HTTP_STATUS.BAD_REQUEST);
  }

  const productPools = selectProductPools(store, productId);
  const assetRate = selectAssetRate(store, coverAsset);

  const now = BigNumber.from(Date.now()).div(1000);
  const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(now, product.gracePeriod, period);
  const coverAmountInNxm = amount.mul(WeiPerEther).div(assetRate);

  // rounding up to nearest allocation unit
  const amountToAllocate = divCeil(coverAmountInNxm, NXM_PER_ALLOCATION_UNIT).mul(NXM_PER_ALLOCATION_UNIT);
  console.info(`Amount to allocate: ${formatEther(amountToAllocate)} nxm`);

  let riAmountInNXM = BigNumber.from(0);

  const cover = getLatestCover(store, editedCoverId);

  if (cover && BigNumber.from(cover.start).add(cover.period).lt(now)) {
    throw new ApiError('Cover already expired', HTTP_STATUS.BAD_REQUEST);
  }

  // check if the allocated amount is greater than the RI threshold
  if (useRiVaults) {
    const totalActiveCoverInNXM = selectActiveCoverAmount(store, productId, now);
    const usdcRate = selectAssetRate(store, 6);

    const activeCover =
      cover && now.lt(BigNumber.from(cover.start).add(cover.period))
        ? cover.poolAllocations.reduce((acc, pool) => {
            const poolAmount = BigNumber.isBigNumber(pool.coverAmountInNxm)
              ? pool.coverAmountInNxm
              : BigNumber.from(pool.coverAmountInNxm);
            return acc.sub(poolAmount);
          }, totalActiveCoverInNXM)
        : totalActiveCoverInNXM;

    const riThresholdInNXM = BigNumber.from(RI_THRESHOLD).mul(WeiPerEther).div(usdcRate);
    const riMinCoverAmountInNXM = BigNumber.from(RI_MIN_COVER_AMOUNT).div(usdcRate);

    // Get product-specific RI cover amount percentage, fall back to default if not set
    const riCoverAmountPercentage = selectRiCoverAmountPercentage(store, productId) ?? RI_COVER_AMOUNT_PERCENTAGE;

    if (activeCover.gt(riThresholdInNXM)) {
      riAmountInNXM = amountToAllocate.mul(riCoverAmountPercentage).div(RI_COVER_AMOUNT_DENOMINATOR);
    } else if (activeCover.lt(riThresholdInNXM) && activeCover.add(amountToAllocate).gt(riThresholdInNXM)) {
      riAmountInNXM = amountToAllocate
        .sub(riThresholdInNXM.sub(activeCover))
        .mul(riCoverAmountPercentage)
        .div(RI_COVER_AMOUNT_DENOMINATOR);
    }
    riAmountInNXM = riAmountInNXM.gt(riMinCoverAmountInNXM) ? riAmountInNXM : BigNumber.from(0);
  }

  const poolsData = productPools.map(pool => {
    const { poolId, targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = pool;

    const availableCapacityInNXM = calculateAvailableCapacityInNXM(
      trancheCapacities,
      allocations,
      firstUsableTrancheIndex,
      cover ? getCoverTrancheAllocations(cover, poolId, now) : [],
    );

    console.info('Pool:', pool.poolId);
    console.info('Available pool capacity:', formatEther(availableCapacityInNXM), 'nxm');

    const basePrice = product.useFixedPrice
      ? targetPrice
      : calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

    return {
      poolId,
      basePrice,
      availableCapacityInNXM,
    };
  });

  // Check capacity for both pools and RI before allocation
  if (useRiVaults && riAmountInNXM.gt(0)) {
    // Calculate total pool capacity
    const totalPoolCapacity = poolsData.reduce((total, pool) => {
      return total.add(pool.availableCapacityInNXM);
    }, Zero);

    // Calculate total RI capacity
    let totalRiCapacity = Zero;
    const expiries = selectVaultEpochExpiryTimestamp(store);
    const coverExpiry = now.add(product.gracePeriod).add(period);
    const epochDuration = RI_EPOCH_DURATION * 24 * 3600;
    const riVaults = selectVaultProducts(store, productId);
    totalRiCapacity = riVaults
      .filter(vault => {
        return vault && expiries[vault.vaultId] && expiries[vault.vaultId].add(epochDuration).gt(coverExpiry);
      })
      .reduce((total, vault) => {
        const availableCapacityInNXM = calculateVaultCapacity(store, vault, now, cover?.coverId || 0);
        return total.add(availableCapacityInNXM);
      }, Zero);

    if (totalPoolCapacity.add(totalRiCapacity).lt(amountToAllocate)) {
      throw new ApiError(
        `Not enough capacity. Required: ${formatEther(amountToAllocate)} NXM, Available: ${formatEther(
          totalPoolCapacity.add(totalRiCapacity),
        )} NXM`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (totalPoolCapacity.lt(amountToAllocate.sub(riAmountInNXM))) {
      riAmountInNXM = amountToAllocate.sub(totalPoolCapacity);
    }

    if (totalRiCapacity.lt(riAmountInNXM)) {
      riAmountInNXM = totalRiCapacity;
    }
  }

  const customPoolIdPriorityFixedPrice = selectProductPriorityPoolsFixedPrice(store, productId) || [];
  const poolsInPriorityOrder = sortPools(poolsData, customPoolIdPriorityFixedPrice);
  const allocations = calculatePoolAllocations(amountToAllocate.sub(riAmountInNXM), poolsInPriorityOrder);

  const poolsWithPremium = allocations.map(allocation => {
    const pool = poolsData.find(data => allocation.poolId === data.poolId);
    const premiumPerYear = calculatePremiumPerYear(allocation.amount, pool.basePrice);

    const premiumInNxm = premiumPerYear.mul(period).div(ONE_YEAR);
    const premiumInAsset = premiumInNxm.mul(assetRate).div(WeiPerEther);

    const coverAmountInAsset = allocation.amount.mul(assetRate).div(WeiPerEther);

    return {
      poolId: pool.poolId,
      premiumInNxm,
      premiumInAsset,
      coverAmountInNxm: allocation.amount,
      coverAmountInAsset,
      availableCapacityInNXM: pool.availableCapacityInNXM,
    };
  });

  const { premiumInNXM, premiumInAsset, coverAmountInAsset } = poolsWithPremium.reduce(
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

  // calculate refund for the edited cover
  const refundInNXM = editedCoverId !== 0 ? calculateCoverRefundInNXM(cover, now) : Zero;
  const refundInAsset = refundInNXM.mul(assetRate).div(WeiPerEther);

  const premiumInNXMWithRefund = premiumInNXM.sub(refundInNXM).gt(0) ? premiumInNXM.sub(refundInNXM) : Zero;
  const premiumInAssetWithRefund = premiumInAsset.sub(refundInAsset).gt(0) ? premiumInAsset.sub(refundInAsset) : Zero;

  const annualPrice = premiumInAsset.gt(0) ? calculateAnualPrice(premiumInAsset, period, coverAmountInAsset) : Zero;

  const riQuote = calculateRiQuote(store, product, period, riAmountInNXM, now, paymentAsset, cover);

  return {
    poolsWithPremium,
    premiumInNXM,
    premiumInAsset,
    refundInNXM,
    refundInAsset,
    premiumInNXMWithRefund,
    premiumInAssetWithRefund,
    annualPrice,
    coverAmountInAsset,
    riQuote,
  };
};

module.exports = {
  quoteEngine,
  calculateBasePrice,
  calculatePremiumPerYear,
  calculatePoolAllocations,
};
