const express = require('express');
const capacityEngine = require('../lib/capacityEngine');
const { bnPropsToString } = require('../lib/helpers');

const router = express.Router();

router.get('/capacity', async (req, res) => {
  const store = req.app.get('store');

  const response = capacityEngine(store);

  res.send(response.map(capacity => bnPropsToString(capacity)));
});

router.get('/capacity/:productId', async (req, res) => {
  const productId = Number(req.params.productId);
  const store = req.app.get('store');

  const capacity = capacityEngine(store, [productId]);

  res.send(bnPropsToString(capacity));
});

module.exports = router;
