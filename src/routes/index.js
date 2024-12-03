const capacityRouter = require('./capacity');
const pricingRouter = require('./pricing');
const quoteRouter = require('./quote');
const reindexRouter = require('./reindex');

module.exports = {
  capacityRouter,
  quoteRouter,
  reindexRouter,
  pricingRouter,
};
