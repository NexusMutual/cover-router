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
  const poolAllocationRequest = {
    coverAmountInAsset: 0,
  };
  const coveredAmount = 0;
  Object.values(product)
    .sort(sortPools)
    .forEach(([poolId, data]) => {
      const { targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = data;
      // TODO: check if it's floor or ceil
      const daysSinceLastUpdate = Math.floor((Date.now() / 1000 - bumpedPriceUpdateTime.toNumber()) / 86_400);
      let initialCapacityUsed = 0;
      let totalCapacity = 0;
      for (let i = startingTranche - currentTranche; i < MAX_ACTIVE_TRANCHES; i += 1) {
        totalCapacity += trancheCapacities[i];
        initialCapacityUsed += allocations[i];
      }
      if (initialCapacityUsed + amount > totalCapacity) {
        return;
      }
      const premium = calculatePremium(
        amount,
        period,
        targetPrice,
        bumpedPrice,
        daysSinceLastUpdate,
        initialCapacityUsed,
        totalCapacity,
      );
      if (premium < premiumInNXM) {
        premiumInNXM = premium;
        poolAllocationRequest.poolId = poolId;
      }
    });
  const currencyRate = Pool.getTokenPriceInAsset(coverAsset);
  const premiumInCoverAsset = premiumInNXM * currencyRate;
  if (paymentAsset === coverAsset) {
    poolAllocationRequest.coverAmountInAsset = premiumInCoverAsset;
  }
  res.send({ premiumInCoverAsset, premiumInNXM, poolAllocationRequest });
});
