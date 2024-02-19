const { ethers, BigNumber } = require('ethers');

const { selectProductPools, selectProduct } = require('../store/selectors');
const { NXM_PER_ALLOCATION_UNIT, TARGET_PRICE_DENOMINATOR } = require('./constants');
const { bnMax, bnMin, calculateTrancheId } = require('./helpers');
const { calculateBasePrice, calculatePremiumPerYear, calculateFixedPricePremiumPerYear } = require('./quoteEngine');

const { WeiPerEther, Zero } = ethers.constants;

function capacityEngine(store, productIds, time, period = 365) {
  const { assets, assetRates } = store.getState();
  const capacities = [];
  const ids = productIds.length === 0 ? Object.keys(store.getState().products) : [...productIds];
  const now = BigNumber.from(Date.now()).div(1000);

  for (const productId of ids) {
    const product = selectProduct(store, productId);

    if (!product) {
      continue;
    }

    const firstActiveTrancheId = calculateTrancheId(time);
    const gracePeriodExpiration = time.add(period).add(product.gracePeriod);
    const firstUsableTrancheId = calculateTrancheId(gracePeriodExpiration);
    const firstUsableTrancheIndex = firstUsableTrancheId - firstActiveTrancheId;

    const productPools = selectProductPools(store, productId);

    const productData = productPools.reduce(
      (accumulated, pool) => {
        const { capacityUsedNXM, capacityAvailableNXM, minBasePrice, totalPremium } = accumulated;
        const { allocations, trancheCapacities, targetPrice, bumpedPrice, bumpedPriceUpdateTime } = pool;

        // sum up all allocations to get used capacity
        const used = allocations.reduce((total, allocation) => total.add(allocation), Zero);
        const totalCapacity = trancheCapacities.reduce((total, capacity) => total.add(capacity), Zero);

        const unusedCapacity = trancheCapacities.reduce((available, capacity, index) => {
          return index < firstUsableTrancheIndex
            ? available.add(bnMin(capacity.sub(allocations[index]), Zero)) // only carry over the negative
            : available.add(capacity.sub(allocations[index]));
        }, Zero);

        const available = bnMax(unusedCapacity, Zero);

        if (available.isZero()) {
          // only add up the used capacity and return the same values for the rest
          return {
            capacityUsedNXM: used.mul(NXM_PER_ALLOCATION_UNIT).add(capacityUsedNXM),
            capacityAvailableNXM,
            minBasePrice,
            totalPremium,
          };
        }

        const basePrice = product.useFixedPrice
          ? targetPrice
          : calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

        // TODO: implement min price by buying the minimum amount of capacity

        const poolPremium = product.useFixedPrice // premium when buying the entire available capacity
          ? calculateFixedPricePremiumPerYear(available, basePrice)
          : calculatePremiumPerYear(available, basePrice, used, totalCapacity);

        return {
          capacityUsedNXM: used.mul(NXM_PER_ALLOCATION_UNIT).add(capacityUsedNXM),
          capacityAvailableNXM: available.mul(NXM_PER_ALLOCATION_UNIT).add(capacityAvailableNXM),
          minBasePrice: minBasePrice.eq(Zero) ? basePrice : bnMin(minBasePrice, basePrice),
          totalPremium: totalPremium.add(poolPremium.mul(NXM_PER_ALLOCATION_UNIT)),
        };
      },
      { capacityUsedNXM: Zero, capacityAvailableNXM: Zero, minBasePrice: Zero, totalPremium: Zero },
    );

    const { capacityAvailableNXM, capacityUsedNXM, minBasePrice, totalPremium } = productData;

    const capacityInAssets = Object.values(assets).map(assetId => ({
      assetId,
      // TODO: use asset decimals instead of generic 18 decimals
      amount: capacityAvailableNXM.mul(assetRates[assetId]).div(WeiPerEther),
    }));

    const minAnnualPrice = WeiPerEther.mul(minBasePrice).div(TARGET_PRICE_DENOMINATOR);
    const maxAnnualPrice = WeiPerEther.mul(totalPremium).div(capacityAvailableNXM);

    capacities.push({
      productId: Number(productId),
      availableCapacity: capacityInAssets,
      usedCapacity: capacityUsedNXM,
      minAnnualPrice,
      maxAnnualPrice,
    });
  }

  return capacities;
}

module.exports = capacityEngine;
