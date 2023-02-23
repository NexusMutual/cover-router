const express = require('express');

const router = require('./routes');
const { store } = require('./store');
const initializeSynchronizer = require('./lib/synchronizer');

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

const sync = initializeSynchronizer(store);

// fetch all the data
sync.fetchAllData();
// listeners
sync.trancheCheck();
sync.subscribeToNewStakingPools();
sync.subscribeToStakingPoolEvents();
sync.subscribeToCoverEvents();

// initiate routes
router(app);

module.exports = app;
