const express = require('express');
const { ethers } = require('ethers');
const router = express.Router();

const config = require('../config');
const { calculatePremium } = require('../lib/helpers');
const { calculateCapacities, calculateTranche, sortPools } = require('../lib/helpers');
const { CONTRACTS_ADDRESSES, SURGE_THRESHOLD_RATIO } = require('../lib/constants');
const PoolAbi = require('../abis/Pool.json');
const { parseEther } = require('ethers/lib/utils');

router.post('/quote', async (req, res) => {
  /*
   * coverAsset -> assetId
   * period -> days
   * */
  const { productId, amount, period, coverAsset, paymentAsset } = req.body;
  let premiumInNXM = 0;
  let premiumInCoverAsset = 0;
  const poolAllocationRequests = [];
  let coveredAmount = 0;

  const url = config.get('provider.http');
  const provider = new ethers.providers.JsonRpcProvider(url);
  const Pool = new ethers.Contract(CONTRACTS_ADDRESSES.Pool, PoolAbi, provider);

  const currentTranche = calculateTranche();
  const startingTranche = calculateTranche(period);
  const productPools = req.store.getState().stakingPools[productId];

  // will be used for best allocations options
  const productSortedData = Object.entries(productPools)
    .sort(sortPools)
    .reduce((acc, [poolId, data]) => {
      if (coveredAmount === amount) {
        return acc;
      }
      acc[poolId] = {};
      const { targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = data;
      const secondsSinceLastUpdate = Math.floor(Date.now() / 1000 - bumpedPriceUpdateTime.toNumber());

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
          secondsSinceLastUpdate,
          acc[poolId].initialCapacityUsed,
          acc[poolId].totalCapacity,
        );
        premiumInNXM += premium;
        poolAllocationRequests.push({ poolId, skip: false, coverAmountInAsset });
      }
      return acc;
    }, {});

  if (coveredAmount !== amount) {
    res.status(500).send('Not enough capacity for the coverAmount');
  }

  if (paymentAsset === coverAsset) {
    const currencyRate = await Pool.getTokenPriceInAsset(coverAsset);
    premiumInCoverAsset = Math.floor((premiumInNXM * currencyRate) / parseEther('1'));
  }

  res.send({ premiumInCoverAsset, premiumInNXM, poolAllocationRequests });
});

module.exports = router;
