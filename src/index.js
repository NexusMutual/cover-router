require('dotenv').config();

const express = require('express');
const { ethers } = require('ethers');
const { addresses } = require('@nexusmutual/deployments');

const config = require('./config');
const { createStore } = require('./store');

const contractFactory = require('./lib/contracts');
const createChainApi = require('./lib/chainApi');
const createEventsApi = require('./lib/eventsApi');
const createSynchronizer = require('./lib/synchronizer');

const capacityRouter = require('./routes/capacity');
const quoteRouter = require('./routes/quote');
const reindexRouter = require('./routes/reindex');

const main = async () => {
  // state
  const store = createStore();

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

  // keeps store in-sync with chain data
  const synchronizer = await createSynchronizer(store, chainApi, eventsApi);

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // add cors header to all requests
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });

  app.set('store', store);
  app.set('synchronizer', synchronizer);

  // initiate routes
  app.use('/v2', capacityRouter);
  app.use('/v2', quoteRouter);
  app.use('/v2', reindexRouter);

  const port = config.get('port');
  app.listen(port).on('listening', () => console.info('Cover Router started on port %d', port));
};

process.on('unhandledRejection', (reason, p) => console.error('Unhandled Rejection at: Promise ', p, reason));

main().catch(err => {
  console.error('Unexpected error', err);
  process.exit(1);
});
