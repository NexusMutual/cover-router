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
  minAnnualPrice: formatUnits(minAnnualPrice),
  maxAnnualPrice: formatUnits(maxAnnualPrice),
});

/**
 * @openapi
 * /v2/capacity/:
 *   get:
 *     tags:
 *       - Capacity
 *     description: Get a capacity for all products
 *     responses:
 *       200:
 *         description: Returns a capacities
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   productId:
 *                     type: integer
 *                     description: The product id
 *                   availableCapacity:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         assetId:
 *                           type: integer
 *                           description: The asset id
 *                         amount:
 *                           type: string
 *                           description: The capacity amount
 *                   allocatedNxm:
 *                     type: string
 *                     description: The allocated NXM
 *                   minAnnualPrice:
 *                     type: string
 *                     description: The minimal annual price
 *                   maxAnnualPrice:
 *                     type: string
 *                     description: The maximal annual price
 */
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

/**
 * @openapi
 * /v2/capacity/{productId}:
 *   get:
 *     tags:
 *       - Capacity
 *     description: Get a capacity for a product
 *     parameters:
 *     - in: path
 *       name: productId
 *       required: false
 *       schema:
 *         type: integer
 *         description: The product id
 *     responses:
 *       200:
 *         description: Returns a capacity
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 productId:
 *                   type: integer
 *                   description: The product id
 *                 availableCapacity:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       assetId:
 *                         type: integer
 *                         description: The asset id
 *                       amount:
 *                         type: string
 *                         description: The capacity amount
 *                 allocatedNxm:
 *                   type: string
 *                   description: The allocated NXM
 *                 minAnnualPrice:
 *                   type: string
 *                   description: The minimal annual price
 *                 maxAnnualPrice:
 *                   type: string
 *                   description: The maximal annual price
 */

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
