const { BigNumber } = require('ethers');
const express = require('express');

const { asyncRoute } = require('../lib/helpers');
const { quoteEngine } = require('../lib/quoteEngine');
const { selectAsset } = require('../store/selectors');

const router = express.Router();

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
 *     - in: query
 *       name: editedCoverId
 *       required: false
 *       schema:
 *         type: integer
 *         description: The id of the cover that is being edited
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
 *       400:
 *         description: Invalid Product Id, or Product is deprecated, or Not enough capacity, or Not original cover id
 */
router.get(
  '/quote',
  asyncRoute(async (req, res) => {
    const productId = Number(req.query.productId);
    const amount = BigNumber.from(req.query.amount);
    const period = BigNumber.from(req.query.period).mul(24 * 3600);
    const coverAsset = Number(req.query.coverAsset);
    const editedCoverId = req.query.coverEditId ? Number(req.query.coverEditId) : 0;

    const store = req.app.get('store');
    const route = quoteEngine(store, productId, amount, period, coverAsset, editedCoverId);

    const poolAllocationRequests = route.poolsWithPremium.reduce((poolAllocationRequests, pool) => {
      return [
        ...poolAllocationRequests,
        {
          poolId: pool.poolId.toString(),
          coverAmountInAsset: pool.coverAmountInAsset.toString(),
        },
      ];
    }, []);

    return {
      body: {
        quote: {
          totalCoverAmountInAsset: route.quoteTotals.coverAmountInAsset.toString(),
          annualPrice: route.quoteTotals.annualPrice.toString(),
          premiumInNXM: route.quoteTotals.premiumInNXM.toString(),
          premiumInAsset: route.quoteTotals.premiumInAsset.toString(),
          poolAllocationRequests,
          asset: selectAsset(store, coverAsset),
        },
        capacities: route.capacities.map(({ poolId, capacity }) => ({
          poolId: poolId.toString(),
          // NOTE: capacity[n].assetId is currently a string (it should ideally a number - BREAKING CHANGE)
          // TODO: Q: do we want to make this change now?
          capacity: capacity.map(({ assetId, amount, asset }) => ({
            assetId: assetId.toString(),
            amount: amount.toString(),
            asset,
          })),
        })),
      },
    };
  }),
);

module.exports = router;
