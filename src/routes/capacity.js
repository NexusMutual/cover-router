const express = require('express');
const router = express.Router();
const { calculateTranche, calculateCapacities } = require('../lib/helpers');
const { MIN_COVER_PERIOD } = require('../lib/constants');

router.get('/capacity', (req, res) => {
  const { products } = req.store.getState();

  const currentTranche = calculateTranche();
  const startingTranche = calculateTranche(MIN_COVER_PERIOD);

  const result = Object.value(products).reduce((acc, [productId, productData]) => {
    acc[productId] = {};
    acc[productId].totalCapacity = 0;
    acc[productId].initialCapacityUsed = 0;
    acc[productId].poolCapacities = {};
    for (const pool of Object.values(productData.stakingPools)) {
      const [poolId, poolData] = pool;
      const { initialCapacityUsed, totalCapacity } = calculateCapacities(
        poolData.trancheCapacities,
        poolData.allocations,
        startingTranche - currentTranche,
      );
      acc[productId].totalCapacity += totalCapacity;
      acc[productId].initialCapacityUsed += initialCapacityUsed;
      acc[productId].poolCapacities[poolId] = { totalCapacity, initialCapacityUsed };
    }
    return acc;
  }, {});
  res.send(result);
});

router.get('/capacity/:productId', (req, res) => {
  const productId = req.params;
  const product = req.store.getState().products[productId];
  if (!product) {
    res.status(400).send('Bad product ID');
  }

  const currentTranche = calculateTranche();
  const startingTranche = calculateTranche(MIN_COVER_PERIOD);

  const result = Object.value(product).reduce(
    (acc, [poolId, poolData]) => {
      const { trancheCapacities, allocations } = poolData;
      const { totalCapacity, initialCapacityUsed } = calculateCapacities(
        trancheCapacities,
        allocations,
        startingTranche - currentTranche,
      );
      acc.totalCapacity += totalCapacity;
      acc.initialCapacityUsed += initialCapacityUsed;
      acc.poolCapacities[poolId] = { totalCapacity, initialCapacityUsed };
      return acc;
    },
    { totalCapacity: 0, initialCapacityUsed: 0, poolCapacities: {} },
  );
  res.send(result);
});
