const { expect } = require('chai');
const {
  utils: { parseEther },
} = require('ethers');
const { BigNumber } = require('ethers');
const sinon = require('sinon');

const { calculatePoolAllocations } = require('../../src/lib/quoteEngine');

const INITIAL_POOL_INDEX = 1;

const sortByBasePrice = (a, b) => a.basePrice - b.basePrice;

// TODO: rewrite all tests
describe.skip('calculateOptimalPoolAllocation', function () {
  this.timeout(0);

  afterEach(function () {
    sinon.restore();
  });

  it('returns optimal pool allocation for 3 pools with all allocation in 1 pool', () => {
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
    let pools = [pool1, pool2, pool3];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = parseEther('1000');
    const optimalAllocations = calculatePoolAllocations(amount, pools);

    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(amount.toString());
  });

  it('returns optimal pool allocation for 2 pools', () => {
    const pool1 = {
      basePrice: BigNumber.from('201'),
      initialCapacityUsed: parseEther('9990'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9990'),
      totalCapacity: parseEther('10000'),
    };

    let i = INITIAL_POOL_INDEX;
    let pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = parseEther('15');
    const optimalAllocations = calculatePoolAllocations(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('5.1').toString());
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('9.9').toString());
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
    let pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = parseEther('30');
    const optimalAllocations = calculatePoolAllocations(amount, pools);

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
    let pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = parseEther('50');
    const optimalAllocations = calculatePoolAllocations(amount, pools);

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
    let pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = parseEther('50');
    const optimalAllocations = calculatePoolAllocations(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('50').toString());
    expect(optimalAllocations[pool2.poolId]).to.be.equal(undefined);
  });

  it('returns optimal pool allocation for 1 million ETH across 3 pools', () => {
    const pool1 = {
      basePrice: BigNumber.from('210'),
      initialCapacityUsed: parseEther('9400000'),
      totalCapacity: parseEther('10000000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9700000'),
      totalCapacity: parseEther('10000000'),
    };

    const pool3 = {
      basePrice: BigNumber.from('214'),
      initialCapacityUsed: parseEther('9700000'),
      totalCapacity: parseEther('10000000'),
    };
    let i = INITIAL_POOL_INDEX;
    let pools = [pool1, pool2, pool3];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = parseEther('1000000');
    const optimalAllocations = calculatePoolAllocations(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('599400').toString());
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('299700').toString());
    expect(optimalAllocations[pool3.poolId].toString()).to.be.equal(parseEther('100900').toString());
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
    let pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = parseEther('60');
    const optimalAllocations = calculatePoolAllocations(amount, pools);

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
    let pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = parseEther('60');
    const optimalAllocations = calculatePoolAllocations(amount, pools);

    expect(optimalAllocations[pool1.poolId]).to.be.equal(undefined);
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('60').toString());
  });

  it('returns optimal pool allocation for 3 pools with fixed pricing where allocation goes to each pool', () => {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9940'),
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
    let pools = [pool1, pool2, pool3];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = parseEther('100');
    const optimalAllocations = calculatePoolAllocations(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('59.9').toString());
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('19.9').toString());
    expect(optimalAllocations[pool3.poolId].toString()).to.be.equal(parseEther('20.2').toString());
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
    let pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = parseEther('1000');
    const optimalAllocations = calculatePoolAllocations(amount, pools);

    // resulting UNIT_SIZE is 3 ETH because of the size of the amount
    // therefore the first pool is only partially filled
    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal(parseEther('799.2').toString());
    expect(optimalAllocations[pool2.poolId].toString()).to.be.equal(parseEther('200.8').toString());
  });

  it('return empty object when there is not enough capacity available to satisfy coverAmount', async function () {
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
    let pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = parseEther('1000');
    const allocations = calculatePoolAllocations(amount, pools);
    expect(allocations).to.deep.equal({});
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
    let pools = [pool1, pool2, pool3, pool4];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    pools = pools.sort(sortByBasePrice);

    const amount = BigNumber.from('88600380000000000000000');
    const optimalAllocations = calculatePoolAllocations(amount, pools);

    expect(optimalAllocations[pool1.poolId].toString()).to.be.equal('159149760000000000000');
    expect(optimalAllocations[pool2.poolId]).to.be.equal(undefined);
    expect(optimalAllocations[pool3.poolId].toString()).to.be.equal('65575468890000000000000');
    expect(optimalAllocations[pool4.poolId].toString()).to.be.equal('22865761350000000000000');
  });
});
