const express = require('express');
const { ethers } = require('ethers');

const config = require('./config');
const router = require('./routes');
const { store: createStore } = require('./store');
const createSynchronizer = require('./lib/synchronizer');
const errorHandler = require('./errorHandler');

/**
 * Express instance
 * @public
 */
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowCrossDomain = function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
};
app.use(allowCrossDomain);

// initiate store before any interaction
app.use(function (req, res, next) {
  req.store = store;
  next();
});

const url = config.get('provider');
const provider = new ethers.providers.WebSocketProvider(url);

const store = createStore();
const synchronizer = createSynchronizer(store, provider);

// initialize synchronizer
synchronizer.initialize();

app.use(function (req, res, next) {
  req.chainAPI = synchronizer.chainAPI;
  next();
});

// initiate routes
router(app);

app.use(errorHandler);

module.exports = app;
