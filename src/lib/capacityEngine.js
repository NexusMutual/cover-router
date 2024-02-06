const { ethers, BigNumber } = require('ethers');

const { selectProductPools, selectProduct } = require('../store/selectors');
const { NXM_PER_ALLOCATION_UNIT, MIN_COVER_PERIOD, TARGET_PRICE_DENOMINATOR } = require('./constants');
const { bnMax, bnMin, calculateTrancheId } = require('./helpers');
const { calculateBasePrice, calculatePremiumPerYear } = require('./quoteEngine');
const { parseEther } = require('ethers/lib/utils');

const { WeiPerEther, Zero } = ethers.constants;

function capacityEngine(store, productIds, time) {
  const { assets, assetRates } = store.getState();
  const capacities = [];
  const ids = productIds.length === 0 ? Object.keys(store.getState().products) : [...productIds];
  const now = BigNumber.from(Date.now()).div(1000);

  for (const productId of ids) {
    const product = selectProduct(store, productId);

    if (!product) {
      continue;
    }

    const productPools = selectProductPools(store, productId);
    const productCapacity = { productId: Number(productId), capacity: [], capacityUsed: Zero };

    const firstActiveTrancheId = calculateTrancheId(time);
    const gracePeriodExpiration = time.add(MIN_COVER_PERIOD).add(product.gracePeriod);
    const firstUsableTrancheId = calculateTrancheId(gracePeriodExpiration);
    const firstUsableTrancheIndex = firstUsableTrancheId - firstActiveTrancheId;

    const { capacityAvailableNXM, capacityUsedNXM, minBasePrice, maxBasePrice } = productPools.reduce(
      ({ capacityAvailableNXM, capacityUsedNXM, minBasePrice, maxBasePrice }, pool) => {
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

        const basePrice = product.useFixedPrice
          ? targetPrice
          : calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

        let maxPoolPrice;
        if (totalCapacity.isZero()) {
          maxPoolPrice = maxBasePrice;
        } else {
          const maxPremium = product.useFixedPrice
            ? targetPrice
            : calculatePremiumPerYear(totalCapacity, basePrice, Zero, totalCapacity);
          maxPoolPrice = maxPremium.mul(TARGET_PRICE_DENOMINATOR).div(totalCapacity);
        }

        return {
          capacityUsedNXM: used.mul(NXM_PER_ALLOCATION_UNIT).add(capacityUsedNXM),
          capacityAvailableNXM: available.mul(NXM_PER_ALLOCATION_UNIT).add(capacityAvailableNXM),
          minBasePrice: minBasePrice.eq(Zero) ? basePrice : bnMin(minBasePrice, basePrice),
          maxBasePrice: maxBasePrice.eq(Zero) ? maxPoolPrice : bnMax(maxBasePrice, maxPoolPrice),
        };
      },
      { capacityAvailableNXM: Zero, capacityUsedNXM: Zero, minBasePrice: Zero, maxBasePrice: Zero },
    );

    for (const assetId of Object.values(assets)) {
      productCapacity.capacity.push({
        assetId,
        // TODO: use asset decimals instead of generic 18 decimals
        amount: capacityAvailableNXM.mul(assetRates[assetId]).div(WeiPerEther),
      });
    }

    productCapacity.capacityUsed = capacityUsedNXM;
    productCapacity.minAnnualPrice = parseEther('1').mul(minBasePrice).div(TARGET_PRICE_DENOMINATOR);
    productCapacity.maxAnnualPrice = parseEther('1').mul(maxBasePrice).div(TARGET_PRICE_DENOMINATOR);
    capacities.push(productCapacity);
  }

  return capacities;
}

module.exports = capacityEngine;
