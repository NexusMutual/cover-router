const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');

const router = require('./routes');
const { useStore } = require('./store');
const getDataAndInitListeners = require('./lib/getDataAndInitListeners');

/**
 * Express instance
 * @public
 */
const app = express();

// parse body params and attach them to req.body
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// secure apps by setting various HTTP headers
app.use(helmet());

// enable CORS - Cross Origin Resource Sharing
app.use(cors());

// initiate store before any interaction
useStore(app);

// TODO: find better name
getDataAndInitListeners(app);

// initiate routes
router(app);

module.exports = app;
