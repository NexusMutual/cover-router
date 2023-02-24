const express = require('express');
const { ethers } = require('ethers');

const config = require('./config');
const router = require('./routes');
const { store } = require('./store');
const createSynchronizer = require('./lib/synchronizer');

/**
 * Express instance
 * @public
 */
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// initiate store before any interaction
app.use(function (req, res, next) {
  req.store = store;
  next();
});

const url = config.get('provider.ws');
const provider = new ethers.providers.WebSocketProvider(url);

const synchronizer = createSynchronizer(store, provider);

// initialize synchronizer
synchronizer.initialize();

// initiate routes
router(app);

module.exports = app;
