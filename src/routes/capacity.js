const express = require('express');
const { BigNumber } = require('ethers');
const router = express.Router();
const { calculateCurrentTrancheId, calculateCapacities } = require('../lib/helpers');
const { MIN_COVER_PERIOD } = require('../lib/constants');
const { parseEther } = require('ethers/lib/utils');

router.get('/capacity', async (req, res) => {
  const { stakingPools, assetId } = req.store.getState();

  const rates = {};
  for (const asset of Object.entries(assetId)) {
    const [symbol, id] = asset;
    rates[symbol] = await req.chainAPI.fetchCurrencyRate(id);
  }

  const currentTranche = calculateCurrentTrancheId();
  const startingTranche = calculateCurrentTrancheId(MIN_COVER_PERIOD);

  const result = Object.entries(stakingPools).reduce((acc, [productId, productData]) => {
    const product = {
      productId,
      netStakedNXM: BigNumber.from(0),
      poolCapacities: [],
    };
    for (const pool of Object.entries(productData)) {
      const [poolId, poolData] = pool;
      const { initialCapacityUsed, totalCapacity } = calculateCapacities(
        poolData.trancheCapacities,
        poolData.allocations,
        startingTranche - currentTranche,
      );
      product.netStakedNXM = product.netStakedNXM.add(totalCapacity).sub(initialCapacityUsed);
      product.poolCapacities.push({
        poolId,
        totalCapacityNXM: totalCapacity.toString(),
        initialCapacityUsedNXM: initialCapacityUsed.toString(),
      });
    }
    for (const asset of Object.entries(rates)) {
      const [symbol, rate] = asset;
      const capacityInAsset = product.netStakedNXM.mul(rate).div(parseEther('1'));
      product[`capacity${symbol}`] = capacityInAsset.toString();
    }
    product.netStakedNXM = product.netStakedNXM.toString();
    acc.push(product);
    return acc;
  }, []);
  res.send(result);
});

router.get('/capacity/:productId', async (req, res) => {
  const { productId } = req.params;
  const { stakingPools, assetId } = req.store.getState();

  const product = stakingPools[productId];
  if (!product) {
    return res.status(400).send('Bad product ID');
  }
  const rates = {};
  for (const asset of Object.entries(assetId)) {
    const [symbol, id] = asset;
    rates[symbol] = await req.chainAPI.fetchCurrencyRate(id);
  }

  const currentTranche = calculateCurrentTrancheId();
  const startingTranche = calculateCurrentTrancheId(MIN_COVER_PERIOD);

  const netStakedNXM = Object.values(product).reduce((acc, poolData) => {
    const { trancheCapacities, allocations } = poolData;
    const { totalCapacity, initialCapacityUsed } = calculateCapacities(
      trancheCapacities,
      allocations,
      startingTranche - currentTranche,
    );
    acc = acc.add(totalCapacity).sub(initialCapacityUsed);
    return acc;
  }, BigNumber.from(0));
  const result = {
    productId,
    netStakedNXM: netStakedNXM.toString(),
  };
  for (const asset of Object.entries(rates)) {
    const [symbol, rate] = asset;
    const capacityInAsset = netStakedNXM.mul(rate).div(parseEther('1'));
    result[`capacity${symbol}`] = capacityInAsset.toString();
  }
  res.send(result);
});

module.exports = router;
