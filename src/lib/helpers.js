const { TRANCHE_DURATION } = require('./constants');

const bnMax = (a, b) => (a.gt(b) ? a : b);

const divCeil = (a, b) => a.div(b).add(a.mod(b).gt(0) ? 1 : 0);

const calculateTrancheId = time => Math.floor(time / TRANCHE_DURATION);

module.exports = {
  bnMax,
  divCeil,
  calculateTrancheId,
};
