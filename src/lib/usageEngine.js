const { ethers } = require('ethers');

const { selectAssetRate, selectAssets, selectPoolProducts, selectPoolIds } = require('../store/selectors');
const { NXM_PER_ALLOCATION_UNIT } = require('./constants');

const { WeiPerEther, Zero } = ethers.constants;

function usageEngine(store, requestedPoolIds = []) {
  const poolIds = requestedPoolIds.length === 0 ? selectPoolIds(store) : [...requestedPoolIds];
  const assetIds = Object.values(selectAssets(store));

  const usage = poolIds.map(poolId => {
    const poolProducts = selectPoolProducts(store, poolId);
    const products = poolProducts.map(pool => {
      const { productId, allocations } = pool;
      const unitsUsed = allocations.reduce((total, allocation) => total.add(allocation), Zero);
      const nxmUsed = unitsUsed.mul(NXM_PER_ALLOCATION_UNIT);

      const capacityUsed = assetIds.map(assetId => {
        const assetRate = selectAssetRate(store, assetId);
        const amount = nxmUsed.mul(assetRate).div(WeiPerEther);
        return { assetId, amount };
      });

      return { productId, capacityUsed };
    });

    return { poolId, products };
  });

  return usage;
}

module.exports = usageEngine;
