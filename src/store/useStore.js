const store = require('./store');

module.exports = function (app) {
  app.set('store', store);
  app.use(function (req, res, next) {
    req.store = store;
    next();
  });
};
