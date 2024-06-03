const { ethers, BigNumber } = require('ethers');
const express = require('express');

const capacityEngine = require('../lib/capacityEngine');
const { asyncRoute } = require('../lib/helpers');

const router = express.Router();
const { formatUnits } = ethers.utils;

const formatCapacityResult = ({ productId, availableCapacity, usedCapacity, minAnnualPrice, maxAnnualPrice }) => ({
  productId,
  availableCapacity: availableCapacity.map(({ assetId, amount, asset }) => ({
    assetId,
    amount: amount.toString(),
    asset,
  })),
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
 *     description: Get capacity data for all products
 *     responses:
 *       200:
 *         description: Returns capacity for all products
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
 *                     description: The maximum available capacity for the product.
 *                                  The max amount of cover a user can buy for the product.
 *                     items:
 *                       type: object
 *                       properties:
 *                         assetId:
 *                           type: integer
 *                           description: The asset id
 *                         amount:
 *                           type: string
 *                           format: integer
 *                           description: The capacity amount expressed in the asset
 *                         asset:
 *                           type: object
 *                           description: An object containing asset info
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: integer
 *                               description: The id of the asset
 *                             symbol:
 *                               type: string
 *                               description: The symbol of the asset
 *                             decimals:
 *                               type: integer
 *                               description: The decimals of the asset
 *                               example: 18
 *                   allocatedNxm:
 *                     type: string
 *                     format: integer
 *                     description: The used capacity amount for active covers on the product.
 *                                  The amount of capacity locked for active covers on the product.
 *                   minAnnualPrice:
 *                     type: string
 *                     description: The minimal annual price is a percentage value between 0-1.
 *                                  It depends on the period query param value (default 30 days).
 *                                  The cover price starts from this value depending on the requested period and amount.
 *                   maxAnnualPrice:
 *                     type: string
 *                     description: The maximal annual price is a percentage value between 0-1.
 *                                  It depends on the period query param value (default 30 days).
 *                                  The cover price starts from this value depending on the requested period and amount.
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
 *     description: Get capacity data for a product
 *     parameters:
 *     - in: path
 *       name: productId
 *       required: false
 *       schema:
 *         type: integer
 *         description: The product id
 *     responses:
 *       200:
 *         description: Returns capacity data for a product
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
 *                   description: The maximum available capacity for the product.
 *                                The max amount of cover a user can buy for the product.
 *                   items:
 *                     type: object
 *                     properties:
 *                       assetId:
 *                         type: integer
 *                         description: The asset id
 *                       amount:
 *                         type: string
 *                         format: integer
 *                         description: The capacity amount expressed in the the asset
 *                       asset:
 *                         type: object
 *                         description: An object containing asset info
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: integer
 *                             description: The id of the asset
 *                           symbol:
 *                             type: string
 *                             description: The symbol of the asset
 *                           decimals:
 *                             type: integer
 *                             description: The decimals of the asset
 *                             example: 18
 *                 allocatedNxm:
 *                   type: string
 *                   description: The used capacity amount for active covers on the product.
 *                                The amount of capacity locked for active covers on the product.
 *                 minAnnualPrice:
 *                   type: string
 *                   description: The minimal annual price is a percentage value (2 decimals).
 *                                It depends on the period query param value (default 30 days).
 *                                The cover price starts from this value depending on the requested period and amount.
 *                 maxAnnualPrice:
 *                   type: string
 *                   description: The maximal annual price is a percentage value (2 decimals).
 *                                It depends on the period query param value (default 30 days).
 *                                The cover price starts from this value depending on the requested period and amount.
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
