const sinon = require('sinon');
const {
  utils: { parseEther },
  constants: { WeiPerEther },
} = require('ethers');
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { calculateOptimalPoolAllocation } = require('../../src/lib/quoteEngine');

const { calculateOptimalPoolAllocationBruteForce } = require('./utils');

const INITIAL_POOL_INDEX = 1;

const MIN_UNIT_SIZE = WeiPerEther;

describe('calculatePreviousCoverAmountsRepriced', function () {
  this.timeout(0);

  afterEach(function() {
    sinon.restore();
  });

  it('calculates previous cover amounts repriced', () => {

  });

});