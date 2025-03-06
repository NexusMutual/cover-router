const { expect } = require('chai');
const {
  utils: { parseEther },
} = require('ethers');
const { BigNumber } = require('ethers');
const sinon = require('sinon');

const { calculatePoolAllocations } = require('../../src/lib/quoteEngine');

const formatPools = pools => {
  return pools.map((pool, id) => {
    return {
      poolId: id + 1,
      basePrice: BigNumber.from(pool.price),
      availableCapacityInNXM: parseEther(pool.capacity),
    };
  });
};

describe('calculateOptimalPoolAllocation', function () {
  this.timeout(0);

  afterEach(function () {
    sinon.restore();
  });

  it('returns optimal pool allocation for 3 pools with all allocation in 1 pool', () => {
    const coverAmount = parseEther('500');

    const pools = formatPools([
      { price: '200', capacity: '1000' },
      { price: '300', capacity: '1000' },
      { price: '400', capacity: '1000' },
    ]);

    const expectedAllocations = [{ poolId: pools[0].poolId, amount: coverAmount }];

    expect(calculatePoolAllocations(coverAmount, pools)).to.deep.equal(expectedAllocations);
  });

  it('returns optimal pool allocation for 2 pools', () => {
    const coverAmount = parseEther('15');

    const pools = formatPools([
      { price: '200', capacity: '10' },
      { price: '201', capacity: '10' },
    ]);

    const expectedAllocations = [
      { poolId: pools[0].poolId, amount: parseEther('10') },
      { poolId: pools[1].poolId, amount: parseEther('5') },
    ];

    expect(calculatePoolAllocations(coverAmount, pools)).to.deep.equal(expectedAllocations);
  });

  it('returns optimal pool allocation for 2 pools where 1 is cheaper but already at full capacity', () => {
    const coverAmount = parseEther('30');

    const pools = formatPools([
      { price: '200', capacity: '0' },
      { price: '210', capacity: '100' },
    ]);

    const expectedAllocations = [{ poolId: pools[1].poolId, amount: parseEther('30') }];

    expect(calculatePoolAllocations(coverAmount, pools)).to.deep.equal(expectedAllocations);
  });

  it('returns optimal pool allocation for 1 million ETH across 3 pools', () => {
    const coverAmount = parseEther('1000000');

    const pools = formatPools([
      { price: '200', capacity: '300000' },
      { price: '210', capacity: '500000' },
      { price: '214', capacity: '700000' },
    ]);

    const expectedAllocations = [
      { poolId: pools[0].poolId, amount: parseEther('300000') },
      { poolId: pools[1].poolId, amount: parseEther('500000') },
      { poolId: pools[2].poolId, amount: parseEther('200000') },
    ];

    expect(calculatePoolAllocations(coverAmount, pools)).to.deep.equal(expectedAllocations);
  });

  it('keeps the priority order when pools are not sorted by price', () => {
    const coverAmount = parseEther('30');

    const pools = formatPools([
      { price: '300', capacity: '15' },
      { price: '200', capacity: '10' },
      { price: '200', capacity: '0' },
      { price: '205', capacity: '20' },
    ]);

    const expectedAllocations = [
      { poolId: pools[0].poolId, amount: parseEther('15') },
      { poolId: pools[1].poolId, amount: parseEther('10') },
      { poolId: pools[3].poolId, amount: parseEther('5') },
    ];

    expect(calculatePoolAllocations(coverAmount, pools)).to.deep.equal(expectedAllocations);
  });

  it('return empty array when there is not enough capacity available to satisfy coverAmount', () => {
    const coverAmount = parseEther('1000');

    const pools = formatPools([
      { price: '200', capacity: '500' },
      { price: '210', capacity: '499' },
    ]);

    const expectedAllocations = [];

    expect(calculatePoolAllocations(coverAmount, pools)).to.deep.equal(expectedAllocations);
  });
});
