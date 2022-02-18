const express = require('express');
const NodeCache = require('node-cache');

const { instanceOf } = require('./initContracts');
const coverAllocation = require('./coverAllocation');

const asyncRoute = route => (req, res, ...rest) => {
  route(req, res, ...rest).catch(e => {
    console.error(`Route error: ${e.stack}`);
    res.status(500).send({
      error: true,
      message: 'Internal server error',
    });
  });
};

module.exports = () => {
  const cache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
  const app = express();

  app.use((req, _, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });

  app.use(
    asyncRoute(async (req, res, next) => {
      const origin = req.get('origin');

      const allow = () => {
        res.header('Access-Control-Allow-Origin', origin);
        next();
      };

      const deny = () =>
        res.status(403).send({
          error: true,
          message: 'Origin not allowed.',
        });

      if (/(\.nexusmutual\.io|localhost:3000)$/.test(origin)) {
        return allow();
      }

      return deny();
    }),
  );

  app.get(
    '/v1/cover-allocation',
    asyncRoute(async (_, res) => {
      // const { CD } = instanceOf;
      // const lastClaimId = await CD.actualClaimLength();
      // if (cache.get('lastClaimId') === lastClaimId.toString()) {
      //   return res.json(cache.get('proofValidity'));
      // }
      // const proofValidity = await checkProofValidity();
      // cache.set('proofValidity', proofValidity);
      // cache.set('lastClaimId', lastClaimId.toString());
      // res.json(proofValidity);
    }),
  );

  return app;
};
