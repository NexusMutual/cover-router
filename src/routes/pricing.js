const express = require('express');

const { asyncRoute } = require('../lib/helpers');
const { pricingEngine } = require('../lib/pricingEngine');

const router = express.Router();

const formatPricingResult = pricing => ({
  productId: pricing.productId,
  pricePerPool: pricing.pricePerPool?.map(p => ({
    poolId: p.poolId,
    targetPrice: p.targetPrice.toNumber(), // basis points (0-10,000)
  })),
  weightedAveragePrice: pricing.weightedAveragePrice.toNumber(), // basis points (0-10,000)
});

/**
 * @openapi
 * /v2/pricing/products/{productId}:
 *   get:
 *     tags:
 *       - Pricing
 *     description: Get pricing data for a specific product
 *     parameters:
 *     - in: path
 *       name: productId
 *       required: true
 *       schema:
 *         type: integer
 *         description: The product id
 *     responses:
 *       200:
 *         description: Returns pricing data of every pool that has capacity for the given product
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PricingResult'
 *             example:
 *               productId: 1
 *               pricePerPool: [
 *                 {
 *                   poolId: 1,
 *                   targetPrice: "0.025"
 *                 },
 *                 {
 *                   poolId: 2,
 *                   targetPrice: "0.035"
 *                 }
 *               ]
 *               weightedAveragePrice: "0.030"
 *       400:
 *         description: Invalid productId
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal Server Error
 */
router.get(
  '/pricing/products/:productId',
  asyncRoute(async (req, res) => {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId < 0) {
      return res.status(400).send({ error: 'Invalid productId: must be an integer', response: null });
    }

    try {
      const store = req.app.get('store');
      const pricingResult = pricingEngine(store, productId);

      if (!pricingResult) {
        return res.status(404).send({ error: 'Product not found', response: null });
      }

      const response = formatPricingResult(pricingResult);
      console.log(JSON.stringify(response, null, 2));

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
 *     PoolPricing:
 *       type: object
 *       properties:
 *         poolId:
 *           type: integer
 *           description: The pool id
 *         targetPrice:
 *           type: string
 *           description: The target price as a percentage expressed as basis points (0-10,000)
 *     PricingResult:
 *       type: object
 *       properties:
 *         productId:
 *           type: integer
 *           description: The product id
 *         pricePerPool:
 *           type: array
 *           description: Array of pricing data per pool
 *           items:
 *             $ref: '#/components/schemas/PoolPricing'
 *         weightedAveragePrice:
 *           type: string
 *           description: The weighted average price across all pools as a percentage expressed as basis points 0-10,000
 *                        The weight is based on the available capacity of the pool.
 */

module.exports = router;
