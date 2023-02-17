const capacityRoutes = require('./capacity');
const quoteRoutes = require('./quote');

module.exports = function (app) {
  app.use('/v2', capacityRoutes);
  app.use('/v2', quoteRoutes);
};
