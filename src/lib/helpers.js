const { TRANCHE_DURATION } = require('./constants');

const bnMax = (a, b) => (a.gt(b) ? a : b);

const divCeil = (a, b) => a.div(b).add(a.mod(b).gt(0) ? 1 : 0);

const calculateTrancheId = time => Math.floor(time / TRANCHE_DURATION);

const asyncRoute = fn => (req, res, next) => {
  fn(req, res, next).catch(err => {
    console.error(err);
    res.status(500).send({ error: 'Internal Server Error', response: null });
  });
};

module.exports = {
  bnMax,
  divCeil,
  calculateTrancheId,
  asyncRoute,
};
