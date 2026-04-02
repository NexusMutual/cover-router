const { expect } = require('chai');
const {
  utils: { parseEther },
} = require('ethers');
const sinon = require('sinon');

const { sortPools } = require('../../src/lib/quoteEngine');

const makePools = pools =>
  pools.map(({ poolId, price }) => ({
    poolId,
    basePrice: price,
    availableCapacityInNXM: parseEther('1000'),
  }));

describe('sortPools', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('should sort pools by ascending base price', () => {
    const pools = makePools([
      { poolId: 1, price: 300 },
      { poolId: 2, price: 100 },
      { poolId: 3, price: 200 },
    ]);

    const sorted = sortPools(pools, []);
    const sortedIds = sorted.map(p => p.poolId);

    expect(sortedIds).to.deep.equal([2, 3, 1]);
  });

  it('should place priority pools first in their custom order', () => {
    const pools = makePools([
      { poolId: 1, price: 100 },
      { poolId: 2, price: 200 },
      { poolId: 3, price: 300 },
    ]);

    const sorted = sortPools(pools, [3, 2, 1]);
    const sortedIds = sorted.map(p => p.poolId);

    expect(sortedIds).to.deep.equal([3, 2, 1]);
  });

  it('should produce consistent ordering for same-price pools within the same hour', () => {
    const hourInMs = 3600 * 1000;
    const fixedTime = Math.floor(Date.now() / hourInMs) * hourInMs + hourInMs / 2;
    sinon.stub(Date, 'now').returns(fixedTime);

    const poolDefs = [
      { poolId: 1, price: 100 },
      { poolId: 2, price: 100 },
      { poolId: 3, price: 100 },
      { poolId: 4, price: 100 },
    ];

    const result1 = sortPools(makePools(poolDefs), []).map(p => p.poolId);
    const result2 = sortPools(makePools(poolDefs), []).map(p => p.poolId);

    expect(result1).to.deep.equal(result2);
  });

  it('should produce different ordering for same-price pools in different hours', () => {
    const hourInMs = 3600 * 1000;
    const hour1 = 1000 * hourInMs;
    const hour2 = 1001 * hourInMs;

    const pools = makePools([
      { poolId: 1, price: 100 },
      { poolId: 2, price: 100 },
      { poolId: 3, price: 100 },
      { poolId: 4, price: 100 },
      { poolId: 5, price: 100 },
    ]);

    const clock = sinon.stub(Date, 'now');

    clock.returns(hour1);
    const result1 = sortPools(pools, []).map(p => p.poolId);

    clock.returns(hour2);
    const result2 = sortPools(pools, []).map(p => p.poolId);

    expect(result1).to.not.deep.equal(result2);
  });

  it('should only randomize within the same price tier', () => {
    const pools = makePools([
      { poolId: 1, price: 200 },
      { poolId: 2, price: 200 },
      { poolId: 3, price: 100 },
      { poolId: 4, price: 300 },
    ]);

    const sorted = sortPools(pools, []);
    const sortedIds = sorted.map(p => p.poolId);

    expect(sortedIds[0]).to.equal(3);
    expect(sortedIds).to.include.members([1, 2]);
    expect(sortedIds.indexOf(1)).to.be.below(sortedIds.indexOf(4));
    expect(sortedIds.indexOf(2)).to.be.below(sortedIds.indexOf(4));
    expect(sortedIds[3]).to.equal(4);
  });

  it('should keep priority pools first even when non-priority pools are cheaper', () => {
    const pools = makePools([
      { poolId: 1, price: 100 },
      { poolId: 2, price: 500 },
      { poolId: 3, price: 200 },
    ]);

    const sorted = sortPools(pools, [2]);
    const sortedIds = sorted.map(p => p.poolId);

    expect(sortedIds[0]).to.equal(2);
    expect(sortedIds.slice(1)).to.deep.equal([1, 3]);
  });
});
