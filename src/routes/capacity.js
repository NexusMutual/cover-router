const express = require('express');
const { BigNumber, ethers } = require('ethers');

const { WeiPerEther } = ethers.constants;
const router = express.Router();

router.get('/capacity', async (req, res) => {
  // TODO: most of this is wrong
  // const { assets, assetRates, poolProducts, products, productPoolIds } = req.store.getState();
  //
  // const currentTranche = calculateCurrentTrancheId();
  // const startingTranche = calculateCurrentTrancheId(MIN_COVER_PERIOD);
  //
  // const result = Object.entries(stakingPools).map(([productId, productData]) => {
  //   const product = {
  //     productId,
  //     netStakedNXM: BigNumber.from(0),
  //     poolCapacities: [],
  //   };
  //
  //   for (const pool of Object.entries(productData)) {
  //     const [poolId, poolData] = pool;
  //     const { initialCapacityUsed, totalCapacity } = calculateCapacities(
  //       poolData.trancheCapacities,
  //       poolData.allocations,
  //       startingTranche - currentTranche,
  //     );
  //
  //     product.netStakedNXM = product.netStakedNXM.add(totalCapacity).sub(initialCapacityUsed);
  //     product.poolCapacities.push({
  //       poolId,
  //       totalCapacityNXM: totalCapacity.toString(),
  //       initialCapacityUsedNXM: initialCapacityUsed.toString(),
  //     });
  //   }
  //
  //   for (const asset of Object.entries(rates)) {
  //     const [symbol, rate] = asset;
  //     const capacityInAsset = product.netStakedNXM.mul(rate).div(WeiPerEther);
  //     product[`capacity${symbol}`] = capacityInAsset.toString();
  //   }
  //
  //   product.netStakedNXM = product.netStakedNXM.toString();
  //
  //   return product;
  // });
  //
  res.send([]);
});

router.get('/capacity/:productId', async (req, res) => {
  // TODO: most of this is wrong
  // const { productId } = req.params;
  // const { stakingPools, assetId } = req.store.getState();
  //
  // const product = stakingPools[productId];
  //
  // if (!product) {
  //   return res.status(400).send('Bad product ID');
  // }
  //
  // const rates = {};
  // for (const asset of Object.entries(assetId)) {
  //   const [symbol, id] = asset;
  //   rates[symbol] = await req.chainAPI.fetchTokenPriceInAsset(id);
  // }
  //
  // const currentTranche = calculateCurrentTrancheId();
  // const startingTranche = calculateCurrentTrancheId(MIN_COVER_PERIOD);
  //
  // const netStakedNXM = Object.values(product).reduce((acc, poolData) => {
  //   const { trancheCapacities, allocations } = poolData;
  //   const { totalCapacity, initialCapacityUsed } = calculateCapacities(
  //     trancheCapacities,
  //     allocations,
  //     startingTranche - currentTranche,
  //   );
  //   acc = acc.add(totalCapacity).sub(initialCapacityUsed);
  //   return acc;
  // }, BigNumber.from(0));
  //
  // const result = {
  //   productId,
  //   netStakedNXM: netStakedNXM.toString(),
  // };
  //
  // for (const asset of Object.entries(rates)) {
  //   const [symbol, rate] = asset;
  //   const capacityInAsset = netStakedNXM.mul(rate).div(WeiPerEther);
  //   result[`capacity${symbol}`] = capacityInAsset.toString();
  // }
  //
  res.send([]);
});

module.exports = router;
