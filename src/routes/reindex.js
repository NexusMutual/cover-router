const express = require('express');

const router = express.Router();

router.get('/reindex', async (req, res) => {
  // only allow requests from 127.0.0.1 and ::ffff:127.0.0.1
  if (!req.ip.endsWith('127.0.0.1')) {
    return res.status(403).send('Forbidden');
  }

  // first send the reply
  res.send('Reindex requested');

  // then reindex all and catch eventual errors
  const synchronizer = req.app.get('synchronizer');
  await Promise.resolve()
    .then(() => synchronizer.updateAssetRates())
    .catch(err => console.error('Error while running updateAssetRates:', err))
    .then(() => synchronizer.updateAll())
    .catch(err => console.error('Error while running updatingAll', err));
});

module.exports = router;
