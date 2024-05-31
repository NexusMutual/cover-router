require('dotenv').config();

const express = require('express');

const mockStore = require('./store');
const capacityRouter = require('../../src/routes/capacity');
const quoteRouter = require('../../src/routes/quote');

const main = () => {
  // state
  const store = { getState: () => mockStore, dispatch: () => null };

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // add cors header to all requests
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });

  app.set('store', store);

  // initiate routes
  app.use('/v2', capacityRouter);
  app.use('/v2', quoteRouter);

  return app;
};

module.exports = main;
