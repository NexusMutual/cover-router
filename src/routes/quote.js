const express = require('express');
const router = express.Router();
const { BigNumber } = require('ethers');

const { calculateCapacities, calculatePremium, calculateCurrentTrancheId, sortPools } = require('../lib/helpers');
const { SURGE_THRESHOLD_RATIO, SURGE_THRESHOLD_DENOMINATOR } = require('../lib/constants');
const { parseEther } = require('ethers/lib/utils');

router.post('/quote', async (req, res) => {
  /*
   * coverAsset -> assetId
   * period -> days
   * */
  const { productId, amount, period, coverAsset, paymentAsset } = req.body;
  let premiumInNXM = BigNumber.from(0);
  let premiumInCoverAsset = BigNumber.from(0);
  const poolAllocationRequests = [];
  let coveredAmount = BigNumber.from(0);
  const periodInSeconds = BigNumber.from(period).mul(86_400);

  const currentTranche = calculateCurrentTrancheId();
  const startingTranche = calculateCurrentTrancheId(periodInSeconds);
  const productPools = req.store.getState().stakingPools[productId];

  // will be used for best allocations options
  const productSortedData = Object.entries(productPools)
    .sort(sortPools)
    .reduce((acc, [poolId, data]) => {
      if (coveredAmount.eq(amount)) {
        return acc;
      }
      acc[poolId] = {};
      const { targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = data;
      const secondsSinceLastUpdate = BigNumber.from(Date.now()).div(1000).sub(bumpedPriceUpdateTime);

      const capacities = calculateCapacities(trancheCapacities, allocations, startingTranche - currentTranche);
      acc[poolId].initialCapacityUsed = capacities.initialCapacityUsed;
      acc[poolId].totalCapacity = capacities.totalCapacity;
      acc[poolId].surgeStart = acc[poolId].totalCapacity.mul(SURGE_THRESHOLD_RATIO).div(SURGE_THRESHOLD_DENOMINATOR);

      console.log(acc[poolId].initialCapacityUsed.add(amount).sub(coveredAmount).lt(acc[poolId].totalCapacity));
      console.log(
        acc[poolId].initialCapacityUsed.toNumber() + amount - coveredAmount.toNumber() <
          acc[poolId].totalCapacity.toNumber(),
      );
      const coverAmountInAsset = acc[poolId].initialCapacityUsed
        .add(amount)
        .sub(coveredAmount)
        .lt(acc[poolId].totalCapacity)
        ? BigNumber.from(amount).sub(coveredAmount)
        : acc[poolId].totalCapacity.sub(acc[poolId].initialCapacityUsed);
      if (coverAmountInAsset.gt(0)) {
        coveredAmount = coveredAmount.add(coverAmountInAsset);
        const premium = calculatePremium(
          coverAmountInAsset,
          period,
          targetPrice,
          bumpedPrice,
          secondsSinceLastUpdate,
          acc[poolId].initialCapacityUsed,
          acc[poolId].totalCapacity,
        );
        premiumInNXM = premiumInNXM.add(premium);
        poolAllocationRequests.push({ poolId, skip: false, coverAmountInAsset });
      }
      return acc;
    }, {});

  if (!coveredAmount.eq(amount)) {
    return res.status(500).send('Not enough capacity for the coverAmount');
  }

  if (paymentAsset === coverAsset) {
    const currencyRate = await req.chainAPI.fetchCurrencyRate(coverAsset);
    premiumInCoverAsset = premiumInNXM.mul(currencyRate).div(parseEther('1'));
  }

  res.send({ premiumInCoverAsset, premiumInNXM, poolAllocationRequests });
});

module.exports = router;
