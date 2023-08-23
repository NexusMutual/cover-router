const { ethers } = require('ethers');

const { selectPoolProducts, selectPoolIds } = require('../store/selectors');
const { NXM_PER_ALLOCATION_UNIT } = require('./constants');

const { WeiPerEther, Zero } = ethers.constants;

function usageEngine(store, poolIds) {
  const { assets, assetRates } = store.getState();
  const usage = [];
  const ids = poolIds.length === 0 ? selectPoolIds(store) : [...poolIds];

  for (const poolId of ids) {
    const poolProducts = selectPoolProducts(store, poolId);

    const poolCapacities = poolProducts.map(pool => {
      const { productId, allocations } = pool;
      const used = allocations.reduce((total, allocation) => total.add(allocation), Zero);
      const capacityUsedNXM = used.mul(NXM_PER_ALLOCATION_UNIT);
      return {
        productId,
        capacityUsed: Object.values(assets).map(assetId => ({
          assetId,
          amount: capacityUsedNXM.mul(assetRates[assetId]).div(WeiPerEther),
        })),
      };
    });

    usage.push({ poolId, products: poolCapacities });
  }

  return usage;
}

module.exports = usageEngine;
