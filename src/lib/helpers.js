const { TRANCHE_DURATION } = require('./constants');
const { BigNumber } = require('ethers');

const bnMax = (a, b) => (a.gt(b) ? a : b);

const divCeil = (a, b) => a.div(b).add(a.mod(b).gt(0) ? 1 : 0);

const calculateTrancheId = time => Math.floor(time / TRANCHE_DURATION);

const bnPropsToString = obj =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    if (BigNumber.isBigNumber(value)) {
      acc[key] = value.toString();
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});

module.exports = {
  bnMax,
  divCeil,
  calculateTrancheId,
  bnPropsToString,
};
