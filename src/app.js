const express = require('express');

const router = require('./routes');
const { useStore } = require('./store');
const getDataAndInitListeners = require('./lib/getDataAndInitListeners');

/**
 * Express instance
 * @public
 */
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('store', store);
app.use(function (req, res, next) {
  req.store = store;
  next();
});

// initiate store before any interaction
useStore(app);

getDataAndInitListeners(app);

// initiate routes
router(app);

module.exports = app;
