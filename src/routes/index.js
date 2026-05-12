const capacityRouter = require('./capacity');
const pricingRouter = require('./pricing');
const quoteRouter = require('./quote');
const reindexRouter = require('./reindex');
const symbioticRouter = require('./symbiotic');

module.exports = {
  capacityRouter,
  quoteRouter,
  reindexRouter,
  pricingRouter,
  symbioticRouter,
};
