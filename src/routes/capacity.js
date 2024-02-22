const express = require('express');
const { ethers, BigNumber } = require('ethers');

const capacityEngine = require('../lib/capacityEngine');
const { asyncRoute } = require('../lib/helpers');

const router = express.Router();
const { formatUnits } = ethers.utils;

const formatCapacityResult = ({ productId, availableCapacity, usedCapacity, minAnnualPrice, maxAnnualPrice }) => ({
  productId,
  availableCapacity: availableCapacity.map(({ assetId, amount }) => ({ assetId, amount: amount.toString() })),
  allocatedNxm: usedCapacity.toString(),
  annualPrice: formatUnits(minAnnualPrice),
  minAnnualPrice: formatUnits(minAnnualPrice),
  maxAnnualPrice: formatUnits(maxAnnualPrice),
});

router.get(
  '/capacity',
  asyncRoute(async (req, res) => {
    const store = req.app.get('store');
    const now = BigNumber.from(Date.now()).div(1000);
    const period = BigNumber.from(req.query.period || 30);

    if (period.lt(28) || period.gt(365)) {
      return res.status(400).send({ error: 'Invalid period', response: null });
    }

    const response = capacityEngine(store, [], now, period);
    res.json(response.map(capacity => formatCapacityResult(capacity)));
  }),
);

router.get(
  '/capacity/:productId',
  asyncRoute(async (req, res) => {
    const productId = Number(req.params.productId);
    const store = req.app.get('store');
    const now = BigNumber.from(Date.now()).div(1000);
    const period = BigNumber.from(req.query.period || 30);

    if (period.lt(28) || period.gt(365)) {
      return res.status(400).send({ error: 'Invalid period', response: null });
    }

    const [capacity] = capacityEngine(store, [productId], now, period);

    if (!capacity) {
      return res.status(400).send({ error: 'Invalid Product Id', response: null });
    }

    res.json(formatCapacityResult(capacity));
  }),
);

module.exports = router;
