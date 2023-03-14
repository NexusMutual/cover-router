const express = require('express');
const capacityEngine = require('../lib/capacityEngine');
const { BigNumber } = require('ethers');

const router = express.Router();

const parseCapacityResult = ({ productId, capacity }) => ({
  productId,
  capacity: capacity.map(({ assetId, amount }) => ({ assetId, amount: amount.toString() })),
});

router.get('/capacity', async (req, res) => {
  const store = req.app.get('store');
  const now = BigNumber.from(Date.now()).div(1000);

  const response = capacityEngine(store, [], now);

  res.send(response.map(capacity => parseCapacityResult(capacity)));
});

router.get('/capacity/:productId', async (req, res) => {
  const productId = Number(req.params.productId);
  const store = req.app.get('store');
  const now = BigNumber.from(Date.now()).div(1000);

  const [capacity] = capacityEngine(store, [productId], now);

  res.send(parseCapacityResult(capacity));
});

module.exports = router;
