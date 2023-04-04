const express = require('express');
const { BigNumber, ethers } = require('ethers');
const quoteEngine = require('../lib/quoteEngine');
const { asyncRoute } = require('../lib/helpers');

const router = express.Router();
const { Zero } = ethers.constants;

router.get(
  '/quote',
  asyncRoute(async (req, res) => {
    const productId = Number(req.query.productId);
    const amount = BigNumber.from(req.query.amount);
    const period = BigNumber.from(req.query.period).mul(24 * 3600);
    const coverAsset = Number(req.query.coverAsset);

    const store = req.app.get('store');
    const route = await quoteEngine(store, productId, amount, period, coverAsset);

    if (!route) {
      return res.status(400).send({ error: 'Invalid Product Id', response: null });
    }

    if (route.length === 0) {
      return res.status(400).send({ error: 'Not enough capacity for the cover amount', response: null });
    }

    const initialQuote = {
      premiumInNXM: Zero,
      premiumInAsset: Zero,
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
        premiumInNXM: quote.premiumInNXM.add(pool.premiumInNxm),
        premiumInAsset: quote.premiumInAsset.add(pool.premiumInAsset),
        capacities: [...quote.capacities, pool.capacities],
        poolAllocationRequests: [...quote.poolAllocationRequests, allocationRequest],
      };
    }, initialQuote);

    const response = {
      quote: {
        premiumInNXM: quote.premiumInNXM.toString(),
        premiumInAsset: quote.premiumInAsset.toString(),
        poolAllocationRequests: quote.poolAllocationRequests,
      },
      capacities: quote.capacities.map(({ poolId, capacity }) => ({
        poolId: poolId.toString(),
        capacity: capacity.map(({ assetId, amount }) => ({ assetId, amount: amount.toString() })),
      })),
    };

    console.log(JSON.stringify(response, null, 2));

    res.json(response);
  }),
);

module.exports = router;
