const { ethers, BigNumber } = require('ethers');

const { selectProductPools, selectProduct } = require('../store/selectors');
const { NXM_PER_ALLOCATION_UNIT } = require('./constants');
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
        const { capacityUsedNXM, capacityAvailableNXM, minPrice, totalPremium } = accumulated;
        const { allocations, trancheCapacities, targetPrice, bumpedPrice, bumpedPriceUpdateTime } = pool;

        // calculating the capacity in allocation points
        const used = allocations.reduce((total, allocation) => total.add(allocation), Zero);
        const total = trancheCapacities.reduce((total, capacity) => total.add(capacity), Zero);

        const unused = trancheCapacities.reduce((available, capacity, index) => {
          return index < firstUsableTrancheIndex
            ? available.add(bnMin(capacity.sub(allocations[index]), Zero)) // only carry over the negative
            : available.add(capacity.sub(allocations[index]));
        }, Zero);

        const availableCapacity = bnMax(unused, Zero);

        // convert to nxm
        const totalInNXM = total.mul(NXM_PER_ALLOCATION_UNIT);
        const usedInNxm = used.mul(NXM_PER_ALLOCATION_UNIT);
        const availableInNXM = availableCapacity.mul(NXM_PER_ALLOCATION_UNIT);

        if (availableCapacity.isZero()) {
          // only add up the used capacity and return the same values for the rest
          return {
            capacityUsedNXM: usedInNxm.add(capacityUsedNXM),
            capacityAvailableNXM,
            minPrice,
            totalPremium,
          };
        }

        const basePrice = product.useFixedPrice
          ? targetPrice
          : calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

        // the minimum price depends on the surge
        // so we buy the smallest possible unit of capacity
        // and calculate the premium per year
        const unitPremium = product.useFixedPrice
          ? calculateFixedPricePremiumPerYear(NXM_PER_ALLOCATION_UNIT, basePrice)
          : calculatePremiumPerYear(NXM_PER_ALLOCATION_UNIT, basePrice, usedInNxm, totalInNXM);

        const poolMinPrice = WeiPerEther.mul(unitPremium).div(NXM_PER_ALLOCATION_UNIT);

        // the maximum price a user would get can only be determined if the entire available
        // capacity is bought because the routing will always pick the cheapest
        // so we're summing up the premium for all pools and then calculate the average at the end
        const poolPremium = product.useFixedPrice
          ? calculateFixedPricePremiumPerYear(availableInNXM, basePrice)
          : calculatePremiumPerYear(availableInNXM, basePrice, usedInNxm, totalInNXM);

        return {
          capacityUsedNXM: usedInNxm.add(capacityUsedNXM),
          capacityAvailableNXM: availableInNXM.add(capacityAvailableNXM),
          minPrice: minPrice.eq(Zero) ? poolMinPrice : bnMin(minPrice, poolMinPrice),
          totalPremium: totalPremium.add(poolPremium),
        };
      },
      { capacityUsedNXM: Zero, capacityAvailableNXM: Zero, minPrice: Zero, totalPremium: Zero },
    );

    const { capacityAvailableNXM, capacityUsedNXM, minPrice, totalPremium } = productData;

    const capacityInAssets = Object.values(assets).map(assetId => ({
      assetId,
      // TODO: use asset decimals instead of generic 18 decimals
      amount: capacityAvailableNXM.mul(assetRates[assetId]).div(WeiPerEther),
    }));

    const maxAnnualPrice = capacityAvailableNXM.isZero()
      ? Zero
      : WeiPerEther.mul(totalPremium).div(capacityAvailableNXM);

    capacities.push({
      productId: Number(productId),
      availableCapacity: capacityInAssets,
      usedCapacity: capacityUsedNXM,
      minAnnualPrice: minPrice,
      maxAnnualPrice,
    });
  }

  return capacities;
}

module.exports = capacityEngine;
