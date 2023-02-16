const express = require('express');
const ethers = require('ethers');
const router = express.Router();

const config = require('../config');
const { calculatePremium } = require('../lib/pricing');
const {
  CONTRACTS_ADDRESSES,
  TRANCHE_DURATION_DAYS,
  MAX_ACTIVE_TRANCHES,
  PRICE_CHANGE_PER_DAY,
  SURGE_THRESHOLD_RATIO,
} = require('../lib/constants');
const PoolAbi = require('../abis/Pool.json');

function sortPools([, a], [, b]) {
  const daysSinceLastUpdateA = Math.floor((Date.now() / 1000 - a.bumpedPriceUpdateTime.toNumber()) / 86_400);
  const daysSinceLastUpdateB = Math.floor((Date.now() / 1000 - b.bumpedPriceUpdateTime.toNumber()) / 86_400);

  const basePriceA = Math.max(
    a.targetPrice.toNumber(),
    a.bumpedPrice.toNumber() - daysSinceLastUpdateA * PRICE_CHANGE_PER_DAY,
  );
  const basePriceB = Math.max(
    b.targetPrice.toNumber(),
    b.bumpedPrice.toNumber() - daysSinceLastUpdateB * PRICE_CHANGE_PER_DAY,
  );
  if (basePriceA < basePriceB) {
    return -1;
  }
  if (basePriceA > basePriceB) {
    return 1;
  }
  return 0;
}

function calculateCapacities(trancheCapacities, allocations, startingTrancheIndex) {
  let initialCapacityUsed = 0;
  let totalCapacity = 0;
  for (let i = startingTrancheIndex; i < MAX_ACTIVE_TRANCHES; i += 1) {
    totalCapacity += trancheCapacities[i];
    initialCapacityUsed += allocations[i];
  }
  return { initialCapacityUsed, totalCapacity };
}

router.get('/quote', (req, res) => {
  /*
   * coverAsset -> assetId
   * */
  const { productId, amount, period, coverAsset, paymentAsset } = req.body;
  let premiumInNXM = 0;

  const url = config.get('provider.http');
  const provider = new ethers.providers.JsonRpcProvider(url);
  const Pool = new ethers.Contract(CONTRACTS_ADDRESSES.Pool, PoolAbi, provider);

  const currentTranche = Math.floor(Date.now()) / (86_400_000 * TRANCHE_DURATION_DAYS);
  const startingTranche = Math.floor(Date.now() / 86_400_000 + period) / TRANCHE_DURATION_DAYS;
  const product = req.store.getState().products[productId];
  const poolAllocationRequests = [];
  let coveredAmount = 0;
  const productPools = Object.values(product)
    .sort(sortPools)
    .reduce((acc, [poolId, data]) => {
      if (coveredAmount === amount) {
        return acc;
      }
      acc[poolId] = {};
      const { targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = data;
      // TODO: check if it's floor or ceil
      const daysSinceLastUpdate = Math.floor((Date.now() / 1000 - bumpedPriceUpdateTime.toNumber()) / 86_400);

      const capacities = calculateCapacities(trancheCapacities, allocations, startingTranche - currentTranche);
      acc[poolId].initialCapacityUsed = capacities.initialCapacityUsed;
      acc[poolId].totalCapacity = capacities.totalCapacity;
      acc[poolId].surgeStart = acc[poolId].totalCapacity * SURGE_THRESHOLD_RATIO;
      const coverAmountInAsset =
        acc[poolId].initialCapacityUsed + amount - coveredAmount < acc[poolId].totalCapacity
          ? amount - coveredAmount
          : acc[poolId].totalCapacity - acc[poolId].initialCapacityUsed;
      if (coverAmountInAsset > 0) {
        coveredAmount += coverAmountInAsset;
        const premium = calculatePremium(
          coverAmountInAsset,
          period,
          targetPrice,
          bumpedPrice,
          daysSinceLastUpdate,
          acc[poolId].initialCapacityUsed,
          acc[poolId].totalCapacity,
        );
        premiumInNXM += premium;
        poolAllocationRequests.push({ poolId, skip: false, coverAmountInAsset });
      }
      return acc;
    }, {});
  const currencyRate = Pool.getTokenPriceInAsset(coverAsset);
  const premiumInCoverAsset = premiumInNXM * currencyRate;
  res.send({ premiumInCoverAsset, premiumInNXM, poolAllocationRequests });
});
