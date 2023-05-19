const express = require('express');
const capacityEngine = require('../lib/capacityEngine');
const { BigNumber } = require('ethers');
const { asyncRoute } = require('../lib/helpers');

const router = express.Router();

const formatCapacityResult = ({ productId, capacity, capacityUsed }) => ({
  productId,
  capacity: capacity.map(({ assetId, amount }) => ({ assetId, amount: amount.toString() })),
  capacityUsed: capacityUsed.toString(),
});

router.get(
  '/capacity',
  asyncRoute(async (req, res) => {
    const store = req.app.get('store');
    const now = BigNumber.from(Date.now()).div(1000);

    const response = capacityEngine(store, [], now);
    res.json(response.map(capacity => formatCapacityResult(capacity)));
  }),
);

router.get(
  '/capacity/:productId',
  asyncRoute(async (req, res) => {
    const productId = Number(req.params.productId);
    const store = req.app.get('store');
    const now = BigNumber.from(Date.now()).div(1000);

    const [capacity] = capacityEngine(store, [productId], now);

    if (!capacity) {
      return res.status(400).send({ error: 'Invalid Product Id', response: null });
    }

    res.json(formatCapacityResult(capacity));
  }),
);

module.exports = router;
