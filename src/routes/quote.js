const express = require('express');
const { ethers, BigNumber } = require('ethers');
const router = express.Router();

const config = require('../config');
const { calculatePremium } = require('../lib/pricing');
const { calculateCapacities, calculateTranche, sortPools } = require('../lib/helpers');
const { CONTRACTS_ADDRESSES, SURGE_THRESHOLD_RATIO } = require('../lib/constants');
const PoolAbi = require('../abis/Pool.json');
const StakingProductsAbi = require('../abis/StakingProducts.json');
const { NXM_PER_ALLOCATION_UNIT, TARGET_PRICE_DENOMINATOR } = require('../lib/constants');
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
  const StakingProducts = new ethers.Contract(CONTRACTS_ADDRESSES.StakingProducts, StakingProductsAbi, provider);

  const currentTranche = calculateTranche();
  const startingTranche = calculateTranche(period);
  const product = req.store.getState().products[productId];

  // will be used for best allocations options
  const productPools = Object.entries(product)
    .sort(sortPools)
    .reduce((acc, [poolId, data]) => {
      if (coveredAmount === amount) {
        return acc;
      }
      acc[poolId] = {};
      const { targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = data;
      // TODO: check if it's floor or ceil
      const secondsSinceLastUpdate = Date.now() / 1000 - bumpedPriceUpdateTime.toNumber();

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
  const args = [
    {
      lastEffectiveWeight: product[1].lastEffectiveWeight,
      targetWeight: product[1].targetWeight,
      targetPrice: product[1].targetPrice,
      bumpedPrice: product[1].bumpedPrice,
      bumpedPriceUpdateTime: product[1].bumpedPriceUpdateTime,
    },
    BigNumber.from(period),
    BigNumber.from(amount),
    productPools[1].initialCapacityUsed,
    productPools[1].totalCapacity,
    product[1].targetPrice,
    BigNumber.from(Math.floor(Date.now() / 1000)),
    NXM_PER_ALLOCATION_UNIT,
    BigNumber.from(100),
    BigNumber.from(TARGET_PRICE_DENOMINATOR),
  ];
  const [premiumFromContract] = await StakingProducts.calculatePremium(...args);

  console.log(premiumFromContract.toString());
  console.log(premiumInNXM);
  if (paymentAsset === coverAsset) {
    const currencyRate = await Pool.getTokenPriceInAsset(coverAsset);
    premiumInCoverAsset = Math.floor((premiumInNXM * currencyRate) / parseEther('1'));
  }

  res.send({ premiumInCoverAsset, premiumInNXM, poolAllocationRequests });
});

module.exports = router;
