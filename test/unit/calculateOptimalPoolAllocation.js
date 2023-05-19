const sinon = require('sinon');
const {
  utils: { parseEther },
} = require('ethers');
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { calculateOptimalPoolAllocation } = require('../../src/lib/premium-computations');

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
    const optimalAllocation = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocation.lowestCostAllocation[pool2.poolId].toString()).to.be.equal(amount.toString());
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

    let i = 0;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('20');
    const optimalAllocation = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocation.lowestCostAllocation[pool1.poolId].toString()).to.be.equal(parseEther('10').toString());
    expect(optimalAllocation.lowestCostAllocation[pool2.poolId].toString()).to.be.equal(parseEther('10').toString());
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

    let i = 0;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('30');
    const optimalAllocation = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocation.lowestCostAllocation[pool1.poolId].toString()).to.be.equal(parseEther('13').toString());
    expect(optimalAllocation.lowestCostAllocation[pool2.poolId].toString()).to.be.equal(parseEther('17').toString());
  });

  it('returns optimal pool allocation for 3 pools with no surge pricing', () => {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };

    const pool3 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };

    let i = 0;
    const pools = [pool1, pool2, pool3];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('30');
    const optimalAllocation = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocation.lowestCostAllocation[pool1.poolId].toString()).to.be.equal(parseEther('10').toString());
    expect(optimalAllocation.lowestCostAllocation[pool2.poolId].toString()).to.be.equal(parseEther('10').toString());
    expect(optimalAllocation.lowestCostAllocation[pool3.poolId].toString()).to.be.equal(parseEther('10').toString());
  });

  it('returns optimal pool allocation for 3 pools with surge pricing', () => {
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

    const pool3 = {
      basePrice: BigNumber.from('214'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };

    let i = 0;
    const pools = [pool1, pool2, pool3];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('30');
    const optimalAllocation = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocation.lowestCostAllocation[pool1.poolId].toString()).to.be.equal(parseEther('12').toString());
    expect(optimalAllocation.lowestCostAllocation[pool2.poolId].toString()).to.be.equal(parseEther('17').toString());
    expect(optimalAllocation.lowestCostAllocation[pool3.poolId].toString()).to.be.equal(parseEther('1').toString());
  });

  it('returns optimal pool allocation for 3 pools with fixed pricing where it all goes to the first pool', () => {
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

    let i = 0;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('60');
    const optimalAllocation = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocation.lowestCostAllocation[pool1.poolId].toString()).to.be.equal(parseEther('60').toString());
    expect(optimalAllocation.lowestCostAllocation[pool2.poolId]).to.be.equal(undefined);
  });

  it('returns optimal pool allocation for 3 pools with fixed pricing where allocation goes to 2 of the 3 pools', () => {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9950'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9990'),
      totalCapacity: parseEther('10000'),
    };

    const pool3 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('9970'),
      totalCapacity: parseEther('10000'),
    };

    let i = 0;
    const pools = [pool1, pool2, pool3];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('60');
    const optimalAllocation = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocation.lowestCostAllocation[pool1.poolId].toString()).to.be.equal(parseEther('40').toString());
    expect(optimalAllocation.lowestCostAllocation[pool3.poolId].toString()).to.be.equal(parseEther('20').toString());
  });

  it('returns optimal pool allocation when 1 pool is filled to capacity and partially fills the second', () => {
    const pool1 = {
      basePrice: BigNumber.from('200'),
      initialCapacityUsed: parseEther('8000'),
      totalCapacity: parseEther('10000'),
    };

    const pool2 = {
      basePrice: BigNumber.from('3000'),
      initialCapacityUsed: parseEther('7000'),
      totalCapacity: parseEther('10000'),
    };

    let i = 0;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('3000');
    const optimalAllocation = calculateOptimalPoolAllocation(amount, pools);

    // resulting UNIT_SIZE is 3 ETH because of the size of the amount
    // therefore the first pool is only partially filled
    expect(optimalAllocation.lowestCostAllocation[pool1.poolId].toString()).to.be.equal(parseEther('1998').toString());
    expect(optimalAllocation.lowestCostAllocation[pool2.poolId].toString()).to.be.equal(parseEther('1002').toString());
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

    let i = 0;
    const pools = [pool1, pool2];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('1000');
    const { lowestCostAllocation } = calculateOptimalPoolAllocation(amount, pools);
    expect(lowestCostAllocation.length).to.be.equal(0);
  });

  it('returns the same results as the brute force optimization for 6 pools with surge pricing', () => {
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

    const pool3 = {
      basePrice: BigNumber.from('214'),
      initialCapacityUsed: parseEther('8990'),
      totalCapacity: parseEther('10000'),
    };

    const pool4 = {
      basePrice: BigNumber.from('220'),
      initialCapacityUsed: parseEther('8980'),
      totalCapacity: parseEther('10000'),
    };

    const pool5 = {
      basePrice: BigNumber.from('230'),
      initialCapacityUsed: parseEther('8980'),
      totalCapacity: parseEther('10000'),
    };

    const pool6 = {
      basePrice: BigNumber.from('240'),
      initialCapacityUsed: parseEther('8980'),
      totalCapacity: parseEther('10000'),
    };

    let i = 0;
    const pools = [pool1, pool2, pool3, pool4, pool5, pool6];
    pools.forEach(pool => {
      pool.poolId = i++;
    });

    const amount = parseEther('100');
    const optimalAllocation = calculateOptimalPoolAllocation(amount, pools);

    const optimalBruteForceAllocation = calculateOptimalPoolAllocation(amount, pools);

    expect(optimalAllocation.lowestCostAllocation[pool1.poolId].toString()).to.be.equal(
      optimalBruteForceAllocation.lowestCostAllocation[pool1.poolId].toString(),
    );

    expect(optimalAllocation.lowestCostAllocation[pool2.poolId].toString()).to.be.equal(
      optimalBruteForceAllocation.lowestCostAllocation[pool2.poolId].toString(),
    );

    expect(optimalAllocation.lowestCostAllocation[pool3.poolId].toString()).to.be.equal(
      optimalBruteForceAllocation.lowestCostAllocation[pool3.poolId].toString(),
    );

    expect(optimalAllocation.lowestCostAllocation[pool4.poolId].toString()).to.be.equal(
      optimalBruteForceAllocation.lowestCostAllocation[pool4.poolId].toString(),
    );

    expect(optimalAllocation.lowestCostAllocation[pool5.poolId].toString()).to.be.equal(
      optimalBruteForceAllocation.lowestCostAllocation[pool5.poolId].toString(),
    );

    expect(optimalAllocation.lowestCostAllocation[pool6.poolId]).to.be.equal(undefined);
    expect(optimalBruteForceAllocation.lowestCostAllocation[pool6.poolId]).to.be.equal(undefined);
  });
});
