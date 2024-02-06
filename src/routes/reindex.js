const express = require('express');
const { asyncRoute } = require('../lib/helpers');

const router = express.Router();

router.get(
  '/reindex',
  asyncRoute(async (req, res) => {
    const synchronizer = req.app.get('synchronizer');

    await synchronizer.updateAll();
    await synchronizer.updateAssetRates();

    res.sendStatus(200);
  }),
);

module.exports = router;
