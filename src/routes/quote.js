const express = require('express');
const { BigNumber, ethers } = require('ethers');
const quoteEngine = require('../lib/quoteEngine');

const router = express.Router();
const { Zero } = ethers.constants;

const asyncRoute = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(err => {
    console.error(err);
    res.status(500).send({ error: 'Internal Server Error' });
  });
};

router.get(
  '/quote',
  asyncRoute(async (req, res) => {
    const productId = Number(req.query.productId);
    const amount = BigNumber.from(req.query.amount);
    const period = BigNumber.from(req.query.period).mul(24 * 3600);
    const coverAsset = Number(req.query.coverAsset);

    const store = req.app.get('store');
    const route = await quoteEngine(store, productId, amount, period, coverAsset);

    const initialQuote = {
      premiumInNXM: Zero,
      premiumInAsset: Zero,
      poolAllocationRequests: [],
    };

    const quote = route.reduce((quote, pool) => {
      console.log('reduce:', { quote, pool });
      const allocationRequest = {
        poolId: pool.poolId.toString(),
        coverAmountInAsset: pool.coverAmountInAsset.toString(),
        skip: false,
      };
      return {
        premiumInNXM: quote.premiumInNXM.add(pool.premiumInNxm),
        premiumInAsset: quote.premiumInAsset.add(pool.premiumInAsset),
        poolAllocationRequests: [...quote.poolAllocationRequests, allocationRequest],
      };
    }, initialQuote);

    const quoteResponse = {
      premiumInNXM: quote.premiumInNXM.toString(),
      premiumInAsset: quote.premiumInAsset.toString(),
      poolAllocationRequests: quote.poolAllocationRequests,
    };

    res.send(quoteResponse);
  }),
);

module.exports = router;
