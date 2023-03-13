const express = require('express');
const { BigNumber } = require('ethers');
const capacityEngine = require('../lib/capacityEngine');

const { selectProduct } = require('../store/selectors');
const { MIN_COVER_PERIOD } = require('../lib/constants');
const { calculateTrancheId } = require('../lib/helpers');

const router = express.Router();

router.get('/capacity', async (req, res) => {
  const store = req.app.get('store');
  const { products } = store.getState();

  const now = BigNumber.from(Date.now()).div(1000);
  const firstActiveTrancheId = calculateTrancheId(now);

  const response = [];

  for (const [productId, product] of Object.entries(products)) {
    const gracePeriodExpiration = now.add(MIN_COVER_PERIOD).add(product.gracePeriod);
    const firstUsableTrancheId = calculateTrancheId(gracePeriodExpiration);
    const firstUsableTrancheIndex = firstUsableTrancheId - firstActiveTrancheId;

    response.push(capacityEngine(store, productId, firstUsableTrancheIndex));
  }

  res.send(response);
});

router.get('/capacity/:productId', async (req, res) => {
  const productId = Number(req.params.productId);
  const store = req.app.get('store');
  const product = selectProduct(store, productId);

  if (!product) {
    return res.status(400).send('Bad product ID');
  }

  const now = BigNumber.from(Date.now()).div(1000);
  const gracePeriodExpiration = now.add(MIN_COVER_PERIOD).add(product.gracePeriod);

  const firstActiveTrancheId = calculateTrancheId(now);
  const firstUsableTrancheId = calculateTrancheId(gracePeriodExpiration);
  const firstUsableTrancheIndex = firstUsableTrancheId - firstActiveTrancheId;

  const capacity = capacityEngine(store, productId, firstUsableTrancheIndex);

  res.send(capacity);
});

module.exports = router;
