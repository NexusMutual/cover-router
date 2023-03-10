require('dotenv').config();

const express = require('express');
const { ethers } = require('ethers');

const config = require('./config');
const { createStore } = require('./store');

const contractFactory = require('./lib/contracts');
const createChainApi = require('./lib/chainApi');
const createEventsApi = require('./lib/eventsApi');
const createSynchronizer = require('./lib/synchronizer');

const capacityRouter = require('./routes/capacity');
const quoteRouter = require('./routes/quote');

const main = async () => {
  // state
  const store = createStore();

  // provider
  const providerURL = config.get('provider');
  const provider = new ethers.providers.WebSocketProvider(providerURL);

  // contract factory
  const addresses = require(config.get('contractAddresses')).CONTRACTS_ADDRESSES;
  const contracts = await contractFactory(addresses, provider);

  // apis
  const chainApi = await createChainApi(contracts);
  const eventsApi = await createEventsApi(provider, contracts);

  // keeps store in-sync with chain data
  await createSynchronizer(store, chainApi, eventsApi);

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.set('store', store);

  // initiate routes
  app.use('/v2', capacityRouter);
  app.use('/v2', quoteRouter);

  const port = config.get('port');
  app.listen(port).on('listening', () => console.info('Cover Router started on port %d', port));
};

process.on('unhandledRejection', (reason, p) => console.error('Unhandled Rejection at: Promise ', p, reason));

main().catch(err => {
  console.error('Unexpected error', err);
  process.exit(1);
});
