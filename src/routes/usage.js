const express = require('express');
const usageEngine = require('../lib/usageEngine');
const { asyncRoute } = require('../lib/helpers');

const router = express.Router();

const formatUsageResult = ({ poolId, products }) => ({
  poolId: poolId.toString(),
  products: products.map(({ productId, capacityUsed }) => ({
    productId,
    capacityUsed: capacityUsed.map(({ assetId, amount }) => ({ assetId, amount: amount.toString() })),
  })),
});

router.get(
  '/usage',
  asyncRoute(async (req, res) => {
    const store = req.app.get('store');
    const response = usageEngine(store, []);
    res.json(response.map(usage => formatUsageResult(usage)));
  }),
);

router.get(
  '/usage/:poolId',
  asyncRoute(async (req, res) => {
    const poolId = Number(req.params.poolId);
    const store = req.app.get('store');
    const [usage] = usageEngine(store, [poolId]);

    if (!usage) {
      return res.status(400).send({ error: 'Invalid Pool Id', response: null });
    }

    res.json(formatUsageResult(usage));
  }),
);

module.exports = router;
