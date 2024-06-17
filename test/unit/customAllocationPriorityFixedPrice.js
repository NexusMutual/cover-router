const { expect } = require('chai');
const { BigNumber } = require('ethers');

const { customAllocationPriorityFixedPrice } = require('../../src/lib/quoteEngine');

describe('customAllocationPriorityFixedPrice', () => {
  const poolIdPriority = [18, 22, 1];

  it('returns allocation with all allocated to the first pool priority for fixed priced products', async () => {
    const amountToAllocate = BigNumber.from(200);
    const poolsData = [
      { poolId: 1, totalCapacity: BigNumber.from(500), initialCapacityUsed: BigNumber.from(300) },
      { poolId: 18, totalCapacity: BigNumber.from(500), initialCapacityUsed: BigNumber.from(100) },
      { poolId: 22, totalCapacity: BigNumber.from(500), initialCapacityUsed: BigNumber.from(200) },
    ];
    const allocations = await customAllocationPriorityFixedPrice(amountToAllocate, poolsData, [...poolIdPriority]);
    expect(allocations).to.deep.equal({ 18: BigNumber.from(200) });
  });

  it('returns allocation with 1st pool priority is filled fully and partially fills the 2nd priority', async () => {
    const amountToAllocate = BigNumber.from(600);
    const poolsData = [
      { poolId: 1, totalCapacity: BigNumber.from(500), initialCapacityUsed: BigNumber.from(0) },
      { poolId: 18, totalCapacity: BigNumber.from(500), initialCapacityUsed: BigNumber.from(300) },
      { poolId: 22, totalCapacity: BigNumber.from(500), initialCapacityUsed: BigNumber.from(0) },
    ];
    const allocations = await customAllocationPriorityFixedPrice(amountToAllocate, poolsData, [...poolIdPriority]);
    expect(allocations).to.deep.equal({ 18: BigNumber.from(200), 22: BigNumber.from(400) });
  });

  it('returns pool allocation for 3 with allocation goes to each pool in order of priority', async () => {
    const amountToAllocate = BigNumber.from(1000000);
    const poolsData = [
      { poolId: 1, totalCapacity: BigNumber.from(500000), initialCapacityUsed: BigNumber.from(100000) },
      { poolId: 18, totalCapacity: BigNumber.from(500000), initialCapacityUsed: BigNumber.from(0) },
      { poolId: 22, totalCapacity: BigNumber.from(500000), initialCapacityUsed: BigNumber.from(200000) },
    ];
    const allocations = await customAllocationPriorityFixedPrice(amountToAllocate, poolsData, [...poolIdPriority]);
    const expectedAllocations = { 18: BigNumber.from(500000), 22: BigNumber.from(300000), 1: BigNumber.from(200000) };
    expect(allocations).to.deep.equal(expectedAllocations);
  });

  it('returns empty array when there is no capacity available to allocate', async function () {
    const amountToAllocate = BigNumber.from(1000);
    const poolsData = [
      { poolId: 1, totalCapacity: BigNumber.from(500), initialCapacityUsed: BigNumber.from(500) },
      { poolId: 18, totalCapacity: BigNumber.from(500), initialCapacityUsed: BigNumber.from(500) },
      { poolId: 22, totalCapacity: BigNumber.from(500), initialCapacityUsed: BigNumber.from(500) },
    ];
    const allocations = await customAllocationPriorityFixedPrice(amountToAllocate, poolsData, [...poolIdPriority]);
    expect(allocations).to.deep.equal([]);
  });
});
