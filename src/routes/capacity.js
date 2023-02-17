const express = require('express');
const { BigNumber } = require('ethers');
const router = express.Router();
const { calculateTranche, calculateCapacities } = require('../lib/helpers');
const { MIN_COVER_PERIOD } = require('../lib/constants');

router.get('/capacity', (req, res) => {
  const { products } = req.store.getState();

  const currentTranche = calculateTranche();
  const startingTranche = calculateTranche(MIN_COVER_PERIOD);

  const result = Object.entries(products).reduce((acc, [productId, productData]) => {
    acc[productId] = {};
    acc[productId].totalCapacity = BigNumber.from(0);
    acc[productId].initialCapacityUsed = BigNumber.from(0);
    acc[productId].poolCapacities = {};
    for (const pool of Object.entries(productData)) {
      const [poolId, poolData] = pool;
      const { initialCapacityUsed, totalCapacity } = calculateCapacities(
        poolData.trancheCapacities,
        poolData.allocations,
        startingTranche - currentTranche,
      );
      acc[productId].totalCapacity = acc[productId].totalCapacity.add(totalCapacity);
      acc[productId].initialCapacityUsed = acc[productId].initialCapacityUsed.add(initialCapacityUsed);
      acc[productId].poolCapacities[poolId] = { totalCapacity, initialCapacityUsed };
    }
    return acc;
  }, {});
  res.send(result);
});

router.get('/capacity/:productId', (req, res) => {
  const { productId } = req.params;
  const product = req.store.getState().products[productId];
  if (!product) {
    res.status(400).send('Bad product ID');
  }

  const currentTranche = calculateTranche();
  const startingTranche = calculateTranche(MIN_COVER_PERIOD);

  const result = Object.entries(product).reduce(
    (acc, [poolId, poolData]) => {
      const { trancheCapacities, allocations } = poolData;
      const { totalCapacity, initialCapacityUsed } = calculateCapacities(
        trancheCapacities,
        allocations,
        startingTranche - currentTranche,
      );
      acc.totalCapacity = acc.totalCapacity.add(totalCapacity);
      acc.initialCapacityUsed = acc.initialCapacityUsed.add(initialCapacityUsed);
      acc.poolCapacities[poolId] = { totalCapacity, initialCapacityUsed };
      return acc;
    },
    { totalCapacity: BigNumber.from(0), initialCapacityUsed: BigNumber.from(0), poolCapacities: {} },
  );
  res.send(result);
});

module.exports = router;