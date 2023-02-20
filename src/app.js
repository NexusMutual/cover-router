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

// initiate store before any interaction
useStore(app);

getDataAndInitListeners(app);

// initiate routes
router(app);

module.exports = app;
