const { ethers, BigNumber } = require('ethers');

const { selectProductPools, selectProduct } = require('../store/selectors');
const { NXM_PER_ALLOCATION_UNIT, MIN_COVER_PERIOD, TARGET_PRICE_DENOMINATOR } = require('./constants');
const { bnMax, bnMin, calculateTrancheId } = require('./helpers');
const { calculateBasePrice } = require('./quoteEngine');
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

    const { capacityAvailableNXM, capacityUsedNXM, minBasePrice } = productPools.reduce(
      ({ capacityAvailableNXM, capacityUsedNXM, minBasePrice }, pool) => {
        const { allocations, trancheCapacities, targetPrice, bumpedPrice, bumpedPriceUpdateTime } = pool;

        // sum up all allocations to get used capacity
        const used = allocations.reduce((total, allocation) => total.add(allocation), Zero);

        // traverse all tranches and calculate capacity
        const availablePerTranche = trancheCapacities.map((capacity, index) => capacity.sub(allocations[index]));

        // sum up available capacity on a per-tranche basis
        let available = availablePerTranche
          .slice(firstUsableTrancheIndex) // skip unusable
          .reduce((total, free) => total.add(free), Zero);

        // allocations may surpass total capacity in some scenarios
        const carryOver = availablePerTranche
          .slice(0, firstUsableTrancheIndex) // check carry over in unused
          .reduce((total, free) => total.add(free), Zero);

        if (carryOver.lt(0)) {
          available = available.add(carryOver);
        }

        if (available.lt(0)) {
          available = Zero;
        }

        const basePrice = product.useFixedPrice
          ? targetPrice
          : calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

        return {
          capacityUsedNXM: used.mul(NXM_PER_ALLOCATION_UNIT).add(capacityUsedNXM),
          capacityAvailableNXM: available.mul(NXM_PER_ALLOCATION_UNIT).add(capacityAvailableNXM),
          minBasePrice: minBasePrice.eq(Zero) ? basePrice : bnMin(minBasePrice, basePrice),
        };
      },
      { capacityAvailableNXM: Zero, capacityUsedNXM: Zero, minBasePrice: Zero },
    );

    for (const assetId of Object.values(assets)) {
      productCapacity.capacity.push({
        assetId,
        // TODO: use asset decimals instead of generic 18 decimals
        amount: capacityAvailableNXM.mul(assetRates[assetId]).div(WeiPerEther),
      });
    }

    productCapacity.capacityUsed = capacityUsedNXM;
    productCapacity.annualPrice = parseEther('1').mul(minBasePrice).div(TARGET_PRICE_DENOMINATOR);
    capacities.push(productCapacity);
  }

  return capacities;
}

module.exports = capacityEngine;
