const { inspect } = require('node:util');

const { ethers, BigNumber } = require('ethers');
const express = require('express');

const { capacityEngine } = require('../lib/capacityEngine');
const { asyncRoute } = require('../lib/helpers');

const router = express.Router();
const { formatUnits } = ethers.utils;

const formatCapacityResult = capacity => ({
  productId: capacity.productId,
  availableCapacity: capacity.availableCapacity.map(({ assetId, amount, asset }) => ({
    assetId,
    amount: amount.toString(),
    asset,
  })),
  allocatedNxm: capacity.usedCapacity.toString(),
  utilizationRate: capacity.utilizationRate.toNumber(),
  minAnnualPrice: formatUnits(capacity.minAnnualPrice),
  maxAnnualPrice: formatUnits(capacity.maxAnnualPrice),
  capacityPerPool: capacity.capacityPerPool?.map(c => ({
    poolId: c.poolId,
    availableCapacity: c.availableCapacity.map(({ assetId, amount, asset }) => ({
      assetId,
      amount: amount.toString(),
      asset,
    })),
    allocatedNxm: c.allocatedNxm.toString(),
    minAnnualPrice: formatUnits(c.minAnnualPrice),
    maxAnnualPrice: formatUnits(c.maxAnnualPrice),
  })),
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
 *                 $ref: '#/components/schemas/CapacityResult'
 *       400:
 *         description: Invalid period
 *       500:
 *         description: Internal Server Error
 */
router.get(
  '/capacity',
  asyncRoute(async (req, res) => {
    const periodQuery = Number(req.query.period) || 30;

    if (!Number.isInteger(periodQuery) || periodQuery < 28 || periodQuery > 365) {
      return res.status(400).send({ error: 'Invalid period: must be an integer between 28 and 365', response: null });
    }

    try {
      const period = BigNumber.from(periodQuery);
      const store = req.app.get('store');
      const capacities = capacityEngine(store, { period });

      const response = capacities.map(capacity => formatCapacityResult(capacity));
      console.log(inspect(capacities, { depth: null }));

      res.json(response);
    } catch (error) {
      console.error(error);
      return res.status(500).send({ error: 'Internal Server Error', response: null });
    }
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
 *       required: true
 *       schema:
 *         type: integer
 *         description: The product id
 *     - in: query
 *       name: withPools
 *       required: false
 *       schema:
 *         type: boolean
 *         default: false
 *         description: When true, includes `capacityPerPool` field in the response
 *     responses:
 *       200:
 *         description: Returns capacity data for a product. If withPools=true, includes capacityPerPool data.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/CapacityResult'
 *                 - $ref: '#/components/schemas/CapacityResultWithPools'
 *             examples:
 *               withoutPools:
 *                 summary: Response when withPools=false
 *                 value:
 *                   productId: 1
 *                   availableCapacity: [
 *                     {
 *                       assetId: 1,
 *                       amount: "1000000000000000000",
 *                       asset: {
 *                         id: 1,
 *                         symbol: "ETH",
 *                         decimals: 18
 *                       }
 *                     }
 *                   ]
 *                   allocatedNxm: "500000000000000000"
 *                   utilizationRate: 5000
 *                   minAnnualPrice: "0.025"
 *                   maxAnnualPrice: "0.1"
 *               withPools:
 *                 summary: Response when withPools=true
 *                 value:
 *                   productId: 1
 *                   availableCapacity: [
 *                     {
 *                       assetId: 1,
 *                       amount: "1000000000000000000",
 *                       asset: {
 *                         id: 1,
 *                         symbol: "ETH",
 *                         decimals: 18
 *                       }
 *                     }
 *                   ]
 *                   allocatedNxm: "500000000000000000"
 *                   utilizationRate: 5000
 *                   minAnnualPrice: "0.025"
 *                   maxAnnualPrice: "0.1"
 *                   capacityPerPool: [
 *                     {
 *                       poolId: 1,
 *                       availableCapacity: [
 *                         {
 *                           assetId: 1,
 *                           amount: "500000000000000000",
 *                           asset: {
 *                             id: 1,
 *                             symbol: "ETH",
 *                             decimals: 18
 *                           }
 *                         }
 *                       ],
 *                       allocatedNxm: "250000000000000000",
 *                       minAnnualPrice: "0.025",
 *                       maxAnnualPrice: "0.1"
 *                     }
 *                   ]
 *       400:
 *         description: Invalid productId or period
 *       500:
 *         description: Internal Server Error
 */

router.get(
  '/capacity/:productId',
  asyncRoute(async (req, res) => {
    const productId = Number(req.params.productId);
    const periodQuery = Number(req.query.period) || 30;
    const withPools = req.query.withPools === 'true';

    if (!Number.isInteger(periodQuery) || periodQuery < 28 || periodQuery > 365) {
      return res.status(400).send({ error: 'Invalid period: must be an integer between 28 and 365', response: null });
    }
    if (!Number.isInteger(productId) || productId < 0) {
      return res.status(400).send({ error: 'Invalid productId: must be an integer', response: null });
    }

    try {
      const period = BigNumber.from(periodQuery);
      const store = req.app.get('store');
      const [capacity] = capacityEngine(store, { productIds: [productId], period, withPools });

      if (!capacity) {
        return res.status(400).send({ error: 'Invalid Product Id', response: null });
      }

      const response = formatCapacityResult(capacity);
      console.log(inspect(response, { depth: null }));

      res.json(response);
    } catch (error) {
      console.error(error);
      return res.status(500).send({ error: 'Internal Server Error', response: null });
    }
  }),
);

/**
 * @openapi
 * /v2/capacity/pools/{poolId}:
 *   get:
 *     tags:
 *       - Capacity
 *     description: Get capacity data for all products in a specific pool
 *     parameters:
 *     - in: path
 *       name: poolId
 *       required: true
 *       schema:
 *         type: integer
 *         description: The pool id
 *     - in: query
 *       name: period
 *       required: false
 *       schema:
 *         type: integer
 *         minimum: 28
 *         maximum: 365
 *         default: 30
 *         description: The period in days
 *     responses:
 *       200:
 *         description: Returns capacity for all products in the specified pool
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CapacityResult'
 *       400:
 *         description: Invalid pool id or period
 *       404:
 *         description: Pool not found
 *       500:
 *         description: Internal Server Error
 */
router.get(
  '/capacity/pools/:poolId',
  asyncRoute(async (req, res) => {
    const poolId = Number(req.params.poolId);
    const periodQuery = Number(req.query.period) || 30;

    if (!Number.isInteger(periodQuery) || periodQuery < 28 || periodQuery > 365) {
      return res.status(400).send({ error: 'Invalid period: must be an integer between 28 and 365', response: null });
    }
    if (!Number.isInteger(poolId) || poolId <= 0) {
      return res.status(400).send({ error: 'Invalid poolId: must be a positive integer', response: null });
    }

    try {
      const period = BigNumber.from(periodQuery);
      const store = req.app.get('store');
      const capacities = capacityEngine(store, { poolId, period });

      if (capacities.length === 0) {
        return res.status(404).send({ error: 'Pool not found', response: null });
      }

      const response = capacities.map(capacity => formatCapacityResult(capacity));
      console.log(inspect(response, { depth: null }));

      res.json(response);
    } catch (error) {
      console.error(error);
      return res.status(500).send({ error: 'Internal Server Error', response: null });
    }
  }),
);

/**
 * @openapi
 * /v2/capacity/pools/{poolId}/products/{productId}:
 *   get:
 *     tags:
 *       - Capacity
 *     description: Get capacity data for a specific product in a specific pool
 *     parameters:
 *     - in: path
 *       name: poolId
 *       required: true
 *       schema:
 *         type: integer
 *         description: The pool id
 *     - in: path
 *       name: productId
 *       required: true
 *       schema:
 *         type: integer
 *         description: The product id
 *     - in: query
 *       name: period
 *       required: false
 *       schema:
 *         type: integer
 *         minimum: 28
 *         maximum: 365
 *         default: 30
 *         description: The period in days
 *     responses:
 *       200:
 *         description: Returns capacity for the specified product in the specified pool
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CapacityResult'
 *       400:
 *         description: Invalid pool id, product id, or period
 *       404:
 *         description: Product not found in the specified pool
 *       500:
 *         description: Internal Server Error
 */
router.get(
  '/capacity/pools/:poolId/products/:productId',
  asyncRoute(async (req, res) => {
    const poolId = Number(req.params.poolId);
    const productId = Number(req.params.productId);
    const periodQuery = Number(req.query.period) || 30;

    if (!Number.isInteger(periodQuery) || periodQuery < 28 || periodQuery > 365) {
      return res.status(400).send({ error: 'Invalid period: must be an integer between 28 and 365', response: null });
    }
    if (!Number.isInteger(poolId) || poolId <= 0) {
      return res.status(400).send({ error: 'Invalid poolId: must be a positive integer', response: null });
    }
    if (!Number.isInteger(productId) || productId < 0) {
      return res.status(400).send({ error: 'Invalid productId: must be an integer', response: null });
    }
    try {
      const period = BigNumber.from(periodQuery);
      const store = req.app.get('store');
      const [capacity] = capacityEngine(store, { poolId, productIds: [productId], period });

      if (!capacity) {
        return res.status(404).send({ error: 'Product not found in the specified pool', response: null });
      }

      const response = formatCapacityResult(capacity);
      console.log(inspect(response, { depth: null }));

      res.json(response);
    } catch (error) {
      console.error(error);
      return res.status(500).send({ error: 'Internal Server Error', response: null });
    }
  }),
);

/**
 * @openapi
 * components:
 *   schemas:
 *     AssetInfo:
 *       type: object
 *       description: An object containing asset info
 *       properties:
 *         id:
 *           type: integer
 *           description: The id of the asset
 *         symbol:
 *           type: string
 *           description: The symbol of the asset
 *         decimals:
 *           type: integer
 *           description: The decimals of the asset
 *           example: 18
 *     AvailableCapacity:
 *       type: object
 *       properties:
 *         assetId:
 *           type: integer
 *           description: The asset id
 *         amount:
 *           type: string
 *           format: integer
 *           description: The capacity amount expressed in the asset
 *         asset:
 *           $ref: '#/components/schemas/AssetInfo'
 *     BaseCapacityFields:
 *       type: object
 *       properties:
 *         availableCapacity:
 *           type: array
 *           description: The maximum available capacity.
 *           items:
 *             $ref: '#/components/schemas/AvailableCapacity'
 *         allocatedNxm:
 *           type: string
 *           format: integer
 *           description: The used capacity amount for active covers.
 *         minAnnualPrice:
 *           type: string
 *           description: The minimal annual price is a percentage value between 0-1.
 *         maxAnnualPrice:
 *           type: string
 *           description: The maximal annual price is a percentage value between 0-1.
 *     PoolCapacity:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseCapacityFields'
 *         - type: object
 *           properties:
 *             poolId:
 *               type: integer
 *               description: The pool id
 *     CapacityResult:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseCapacityFields'
 *         - type: object
 *           properties:
 *             productId:
 *               type: integer
 *               description: The product id
 *             utilizationRate:
 *               type: number
 *               format: integer
 *               description: The percentage of used capacity to total capacity, expressed as basis points (0-10,000).
 *     CapacityResultWithPools:
 *       allOf:
 *         - $ref: '#/components/schemas/CapacityResult'
 *         - type: object
 *           properties:
 *             capacityPerPool:
 *               type: array
 *               description: The capacity per pool.
 *               items:
 *                 $ref: '#/components/schemas/PoolCapacity'
 */

module.exports = router;
