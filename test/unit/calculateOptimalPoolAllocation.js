const sinon = require('sinon');
const {
  utils: { parseEther },
} = require('ethers');
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { calculateOptimalPoolAllocation } = require('../../src/lib/quoteEngine');

const INITIAL_POOL_INDEX = 1;

describe('calculateOptimalPoolAllocation', function () {
  this.timeout(0);

  afterEach(function () {
    sinon.restore();
  });

  it('returns optimal pool allocation for 3 pools with no surge pricing with all allocation in 1 pool', () => {
    const pool1 = {
      basePrice: BigNumber.from('300'),
      initialCapacityUsed: parseEther('1000'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('1000'),
      totalCapacity: parseEther('10000'),
    };

    const pool3 = {
      basePrice: BigNumber.from('400'),
      initialCapacityUsed: parseEther('1000'),
      totalCapacity: parseEther('10000'),
    };

    let i = 0;
    const pools = [pool1, pool2, pool3];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('1000');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(amount.toString());
  });

  it('returns optimal pool allocation for 2 pools with none reaching surge pricing', () => {
    const pool1 = {
      basePrice: BigNumber.from('201'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };

    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('20');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('10').toString());
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('10').toString());
  });

  it('returns optimal pool allocation for 2 pools with both reaching surge pricing', () => {
    const pool1 = {
      basePrice: BigNumber.from('210'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };

    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('30');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('13').toString());
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('17').toString());
  });

  it('returns optimal pool allocation for 3 pools with no surge pricing', () => {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8996'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8997'),
      totalCapacity: parseEther('10000'),
    };

    const pool3 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8997'),
      totalCapacity: parseEther('10000'),
    };

    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2, pool3];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('10');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('4').toString());
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('3').toString());
    expect(optimalAllocations[pool3.poolId].toString()).to.be.equal(parseEther('3').toString());
  });

  it('returns optimal pool allocation for 3 pools with surge pricing', () => {
    const pool1 = {
      basePrice: BigNumber.from('210'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8960'),
      totalCapacity: parseEther('10000'),
    };

    const pool3 = {
      basePrice: BigNumber.from('214'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };

    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2, pool3];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('100');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('23').toString());
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('57').toString());
    expect(optimalAllocations[pool3.poolId].toString()).to.be.equal(parseEther('20').toString());
  });

  it('returns optimal pool allocation for 2 pools where 1 is cheaper but already at full capacity', () => {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('10000'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('210'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };
    let i = 0;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('30');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool1.poolId]).to.be.equal(undefined);
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('30').toString());
  });

  it('returns optimal pool allocation for 2 pools where both have no capacity used', () => {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('0'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('0'),
      totalCapacity: parseEther('10000'),
    };
    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('50');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('50').toString());
    expect(optimalAllocations[pool2.poolId]).to.be.equal(undefined);
  });

  it('returns optimal pool allocation for 2 pools where both have no capacity used', () => {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('0'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('0'),
      totalCapacity: parseEther('10000'),
    };
    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('50');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('50').toString());
    expect(optimalAllocations[pool2.poolId]).to.be.equal(undefined);
  });

  it('returns optimal pool allocation for 2 pools where one has 0 capacity', () => {
    const pool1 = {
      basePrice: BigNumber.from('210'),
      initialCapacityUsed: parseEther('7000'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('0'),
      totalCapacity: parseEther('0'),
    };
    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('50');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('50').toString());
    expect(optimalAllocations[pool2.poolId]).to.be.equal(undefined);
  });

  it('returns optimal pool allocation for 1 million ETH across 3 pools', () => {
    const pool1 = {
      basePrice: BigNumber.from('210'),
      initialCapacityUsed: parseEther('8990000'),
      totalCapacity: parseEther('10000000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8990000'),
      totalCapacity: parseEther('10000000'),
    };

    const pool3 = {
      basePrice: BigNumber.from('214'),
      initialCapacityUsed: parseEther('8990000'),
      totalCapacity: parseEther('10000000'),
    };
    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2, pool3];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('1000000');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('333000').toString());
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('337000').toString());
    expect(optimalAllocations[pool3.poolId].toString()).to.be.equal(parseEther('330000').toString());
  });

  it('returns optimal pool allocation for 2 same fixed price pools with all allocated to the first', () => {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9910'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9990'),
      totalCapacity: parseEther('10000'),
    };

    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('60');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools, true);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('60').toString());
    expect(optimalAllocations[pool2.poolId]).to.be.equal(undefined);
  });

  it('returns optimal pool allocation for 2 pools with fixed pricing where it all goes to the cheapest pool', () => {
    const pool1 = {
      basePrice: BigNumber.from('210'),
      initialCapacityUsed: parseEther('9910'),
      totalCapacity: parseEther('10000'),
    };
    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8000'),
      totalCapacity: parseEther('10000'),
    };

    let i = 0;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('60');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools, true);

    expect(optimalAllocations[pool1.poolId]).to.be.equal(undefined);
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('60').toString());
  });

  it('returns optimal pool allocation for 3 pools with fixed pricing where allocation goes to each pool', () => {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9950'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9980'),
      totalCapacity: parseEther('10000'),
    };

    const pool3 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9970'),
      totalCapacity: parseEther('10000'),
    };

    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2, pool3];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('100');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools, true);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('50').toString());
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('20').toString());
    expect(optimalAllocations[pool3.poolId].toString()).to.be.equal(parseEther('30').toString());
  });

  it('returns optimal pool allocation when 1 pool is filled to capacity and partially fills the second', () => {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9200'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('3000'),
      initialCapacityUsed: parseEther('7000'),
      totalCapacity: parseEther('10000'),
    };

    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('1000');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    // resulting UNIT_SIZE is 3 ETH because of the size of the amount
    // therefore the first pool is only partially filled
    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('800').toString());
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('200').toString());
  });

  it('return empty array when there is on capacity available to allocate', async function () {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9500'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9600'),
      totalCapacity: parseEther('10000'),
    };

    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('1000');
    const allocations = calculateOptimalPoolAllocation(amount, pools);
    expect(allocations.length).to.be.equal(0);
  });

  it('computes optimal pool allocation across 4 pools', () => {
    const pool1 = {
      basePrice: BigNumber.from('300'),
      initialCapacityUsed: BigNumber.from('0'),
      totalCapacity: BigNumber.from('7228110000000000000000'),
    };
    const pool2 = {
      basePrice: BigNumber.from('600'),
      initialCapacityUsed: BigNumber.from('0'),
      totalCapacity: BigNumber.from('8390570000000000000000'),
    };
    const pool3 = {
      basePrice: BigNumber.from('103'),
      initialCapacityUsed: BigNumber.from('2741190000000000000000'),
      totalCapacity: BigNumber.from('68382300000000000000000'),
    };
    const pool4 = {
      basePrice: BigNumber.from('103'),
      initialCapacityUsed: BigNumber.from('353900000000000000000'),
      totalCapacity: BigNumber.from('23242550000000000000000'),
    };

    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2, pool3, pool4];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = BigNumber.from('88600380000000000000000');
    const minUnitSize = BigNumber.from('188880198128988825736');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal('6613720650000000000000');
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal('347088070000000000000');
    expect(optimalAllocations[pool3.poolId].toString()).to.be.equal('60498761040000000000000');
    expect(optimalAllocations[pool4.poolId].toString()).to.be.equal('21140810240000000000000');
  });

  it('returns the same results as the brute force optimization for 6 pools with surge pricing', () => {
    const pool1 = {
      basePrice: BigNumber.from('210'),
      initialCapacityUsed: parseEther('899'),
      totalCapacity: parseEther('1000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('899'),
      totalCapacity: parseEther('1000'),
    };

    const pool3 = {
      basePrice: BigNumber.from('214'),
      initialCapacityUsed: parseEther('899'),
      totalCapacity: parseEther('1000'),
    };

    const pool4 = {
      basePrice: BigNumber.from('220'),
      initialCapacityUsed: parseEther('898'),
      totalCapacity: parseEther('1000'),
    };

    const pool5 = {
      basePrice: BigNumber.from('230'),
      initialCapacityUsed: parseEther('898'),
      totalCapacity: parseEther('1000'),
    };

    const pool6 = {
      basePrice: BigNumber.from('240'),
      initialCapacityUsed: parseEther('898'),
      totalCapacity: parseEther('1000'),
    };

    let i = INITIAL_POOL_INDEX;
    const pools = [pool1, pool2, pool3, pool4, pool5, pool6];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('10');
    const optimalAllocations = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal('2000000000000000000');

    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal('2500000000000000000');

    expect(optimalAllocations[pool3.poolId].toString()).to.be.equal('1800000000000000000');

    expect(optimalAllocations[pool4.poolId].toString()).to.be.equal('2500000000000000000');

    expect(optimalAllocations[pool5.poolId].toString()).to.be.equal('1200000000000000000');

    expect(optimalAllocations[pool6.poolId]).to.be.equal(undefined);
  });
});
