const sinon = require('sinon');
const {
  utils: { parseEther },
} = require('ethers');
const { expect } = require('chai');
const mockStore = require('../mocks/store');
const { BigNumber } = require('ethers');
const { MIN_COVER_PERIOD } = require('../../src/lib/constants');
const { calculateOptimalPoolAllocation } = require('../../src/lib/premium-computations');

describe.only('Premium computations tests', function () {
  this.timeout(0);

  const store = { getState: () => null };

  afterEach(function() {
    sinon.restore();
  });


  it('returns optimal pool allocation', () => {

    const pool1 = {
      basePrice: BigNumber.from('300'),
      initialCapacityUsed: parseEther('1000'),
      totalCapacity: parseEther('10000')
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('1000'),
      totalCapacity: parseEther('10000')
    };

    const pool3 = {
      basePrice: BigNumber.from('400'),
      initialCapacityUsed: parseEther('1000'),
      totalCapacity: parseEther('10000')
    };

    let i = 0;
    const pools = [pool1, pool2, pool3];
    pools.forEach(pool =>{
      pool.poolId = i++;
    });

    const amount = parseEther('1000');
    const optimalAllocation = calculateOptimalPoolAllocation(amount, pools);

    for (const key in optimalAllocation.lowestCostAllocation) {
      optimalAllocation.lowestCostAllocation[key] = optimalAllocation.lowestCostAllocation[key].div(parseEther('1')).toString()
    }

    console.log({
      optimalAllocation,
      combination: optimalAllocation.lowestCostAllocation.combination,
      amountSplit: optimalAllocation.lowestCostAllocation
    });
  });
});
