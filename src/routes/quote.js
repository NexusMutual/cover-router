const { inspect } = require('node:util');

const { BigNumber, ethers } = require('ethers');
const express = require('express');

const { TARGET_PRICE_DENOMINATOR } = require('../lib/constants');
const { asyncRoute } = require('../lib/helpers');
const { quoteEngine } = require('../lib/quoteEngine');
const { selectAsset } = require('../store/selectors');

const router = express.Router();
const { Zero } = ethers.constants;

/**
 * @openapi
 * /v2/quote:
 *   get:
 *     tags:
 *       - Quote
 *     description: Get a quote for a cover
 *     parameters:
 *     - in: query
 *       name: productId
 *       required: true
 *       schema:
 *         type: integer
 *         description: The product id
 *     - in: query
 *       name: amount
 *       required: true
 *       schema:
 *         type: string
 *         description: The cover amount
 *     - in: query
 *       name: period
 *       required: true
 *       schema:
 *         type: integer
 *         description: The cover period (in days)
 *     - in: query
 *       name: coverAsset
 *       required: true
 *       schema:
 *         type: integer
 *         description: The cover asset assetId (e.g. 0 for ETH, 1 for DAI)
 *     responses:
 *       200:
 *         description: Returns a quote object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 quote:
 *                   type: object
 *                   properties:
 *                     totalCoverAmountInAsset:
 *                       type: string
 *                       format: integer
 *                       description: The total cover amount value in cover asset (smallest unit e.g. wei for ETH)
 *                     annualPrice:
 *                       type: string
 *                       format: integer
 *                       description: The annual price as a percentage value between 0-10,000.
 *                                    Should be divided by 10,000.
 *                     premiumInNXM:
 *                       type: string
 *                       format: integer
 *                       description: The premium value denominated in NXM.
 *                                    To be used when the payment is done using NXM.
 *                     premiumInAsset:
 *                       type: string
 *                       format: integer
 *                       description: The premium value denominated in the cover asset.
 *                                    To be used when the payment is done using the cover asset.
 *                     poolAllocationRequests:
 *                       type: array
 *                       description: Selected pools with necessary capacity for the requested cover.
 *                                    Necessary data for the buy cover tx request.
 *                       items:
 *                         type: object
 *                         properties:
 *                           poolId:
 *                             type: string
 *                             description: The pool id
 *                           coverAmountInAsset:
 *                             type: string
 *                             format: integer
 *                             description: The cover amount value that will be allocated from the pool capacity.
 *                           skip:
 *                             type: boolean
 *                             description: Skip
 *                             default: false
 *                     asset:
 *                       type: object
 *                       description: An object containing cover asset info
 *                       properties:
 *                         id:
 *                           type: integer
 *                           description: The id of the cover asset
 *                         symbol:
 *                           type: string
 *                           description: The symbol of the cover asset
 *                         decimals:
 *                           type: integer
 *                           description: The decimals of the cover asset
 *                           example: 18
 *                 capacities:
 *                   type: array
 *                   description: Show the pools with sufficient (and cheapest) capacity for the requested cover.
 *                   items:
 *                     type: object
 *                     properties:
 *                       poolId:
 *                         type: string
 *                         description: The pool id
 *                       capacity:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             assetId:
 *                               type: string
 *                               format: integer
 *                               description: The id of the asset
 *                             amount:
 *                               type: string
 *                               format: integer
 *                               description: The total capacity amount of the pool expressed in the asset.
 *                             asset:
 *                               type: object
 *                               description: An object containing asset info
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                   description: The id of the asset
 *                                 symbol:
 *                                   type: string
 *                                   description: The symbol of the asset
 *                                 decimals:
 *                                   type: integer
 *                                   description: The decimals of the asset
 *                                   example: 18
 */
router.get(
  '/quote',
  asyncRoute(async (req, res) => {
    const productId = Number(req.query.productId);
    const amount = BigNumber.from(req.query.amount);
    const period = BigNumber.from(req.query.period).mul(24 * 3600);
    const coverAsset = Number(req.query.coverAsset);

    const normalizedRequestQuery = { ...req.query, amount: BigNumber.from(req.query.amount).toString() };
    console.info('Request: ', inspect(normalizedRequestQuery, { depth: null }));

    const store = req.app.get('store');
    const route = await quoteEngine(store, productId, amount, period, coverAsset);

    if (!route) {
      return res.status(400).send({ error: 'Invalid Product Id', response: null });
    }

    if (route.length === 0) {
      return res.status(400).send({ error: 'Not enough capacity for the cover amount', response: null });
    }

    if (route.error && route.error.isDeprecated) {
      return res.status(400).send({ error: 'Product is deprecated', response: null });
    }

    const initialQuote = {
      premiumInNXM: Zero,
      premiumInAsset: Zero,
      totalCoverAmountInAsset: Zero,
      capacities: [],
      poolAllocationRequests: [],
    };

    const quote = route.reduce((quote, pool) => {
      const allocationRequest = {
        poolId: pool.poolId.toString(),
        coverAmountInAsset: pool.coverAmountInAsset.toString(),
        skip: false,
      };
      return {
        totalCoverAmountInAsset: quote.totalCoverAmountInAsset.add(pool.coverAmountInAsset),
        premiumInNXM: quote.premiumInNXM.add(pool.premiumInNxm),
        premiumInAsset: quote.premiumInAsset.add(pool.premiumInAsset),
        capacities: [...quote.capacities, pool.capacities],
        poolAllocationRequests: [...quote.poolAllocationRequests, allocationRequest],
      };
    }, initialQuote);

    const annualPrice = quote.premiumInAsset
      .mul(365 * 24 * 3600)
      .mul(TARGET_PRICE_DENOMINATOR)
      .div(period)
      .div(quote.totalCoverAmountInAsset);

    const response = {
      quote: {
        totalCoverAmountInAsset: quote.totalCoverAmountInAsset.toString(),
        annualPrice: annualPrice.toString(),
        premiumInNXM: quote.premiumInNXM.toString(),
        premiumInAsset: quote.premiumInAsset.toString(),
        poolAllocationRequests: quote.poolAllocationRequests,
        asset: selectAsset(store, coverAsset),
      },
      capacities: quote.capacities.map(({ poolId, capacity }) => ({
        poolId: poolId.toString(),
        // NOTE: capacity[n].assetId is currently a string (it should ideally a number - BREAKING CHANGE)
        capacity: capacity.map(({ assetId, amount, asset }) => ({ assetId, amount: amount.toString(), asset })),
      })),
    };

    console.info('Response: ', inspect(response, { depth: null }));

    res.json(response);
  }),
);

module.exports = router;
