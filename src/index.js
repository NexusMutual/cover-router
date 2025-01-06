require('dotenv').config();

const { addresses } = require('@nexusmutual/deployments');
const { setLogLevel } = require('@nexusmutual/utils');
const { ethers } = require('ethers');
const express = require('express');
const swaggerUI = require('swagger-ui-express');

const config = require('./config');
const createChainApi = require('./lib/chainApi');
const contractFactory = require('./lib/contracts');
const createEventsApi = require('./lib/eventsApi');
const swaggerSpec = require('./lib/swagger');
const createSynchronizer = require('./lib/synchronizer');
const { capacityRouter, pricingRouter, quoteRouter, reindexRouter } = require('./routes');
const { createStore, initialState, load, save } = require('./store');

const main = async () => {
  setLogLevel(config.get('logLevel'));

  // provider
  const providerURL = config.get('provider');
  const provider = new ethers.providers.JsonRpcProvider(providerURL);

  // set a smaller polling interval, default is 4000ms
  provider.pollingInterval = config.get('pollingInterval');

  // contract factory
  const contracts = await contractFactory(addresses, provider);

  // apis
  const chainApi = await createChainApi(contracts);
  const eventsApi = await createEventsApi(provider, contracts);

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // add cors header to all requests
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });

  // initiate routes
  app.use('/v2', capacityRouter);
  app.use('/v2', quoteRouter);
  app.use('/v2', reindexRouter);
  app.use('/v2', pricingRouter);

  // state
  const state = load(initialState);
  const store = createStore(state);
  const isFromCache = state !== initialState;

  // persist the state after each change
  store.subscribe(() => save(store.getState()));

  // keeps store in-sync with chain data
  const synchronizer = await createSynchronizer(store, chainApi, eventsApi);

  app.set('store', store);
  app.set('synchronizer', synchronizer);

  if (!isFromCache) {
    console.warn('Missing initial state, delaying startup until the state is fully loaded');
    await synchronizer.updateAssetRates();
    await synchronizer.updateAll();
  }

  // Serve Swagger documentation
  app.use('/v2/api/docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec));

  const port = config.get('port');
  app.listen(port).on('listening', () => console.info('Cover Router started on port %d', port));

  if (isFromCache) {
    await synchronizer.updateAssetRates();
    await synchronizer.updateAll();
  }
};

process.on('unhandledRejection', (reason, p) => console.error('Unhandled Rejection at: Promise ', p, reason));

main().catch(err => {
  console.error('Unexpected error', err);
  process.exit(1);
});
