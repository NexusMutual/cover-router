const { expect } = require('chai');
const ethers = require('ethers');

const { TRANCHE_DURATION, NXM_PER_ALLOCATION_UNIT, SECONDS_PER_DAY } = require('../../src/lib/constants');
const {
  calculateFirstUsableTrancheIndex,
  calculateProductDataForTranche,
  calculateAvailableCapacity,
} = require('../../src/lib/helpers');
const mockStore = require('../mocks/store');

const { BigNumber } = ethers;
const { WeiPerEther, Zero } = ethers.constants;

describe('helpers', () => {
  describe('calculateFirstUsableTrancheIndex', () => {

    it('should calculate correct index with minimum values (35 days grace, 28 days period)', () => {
      const now = BigNumber.from(1000000);
      const gracePeriod = BigNumber.from(35 * SECONDS_PER_DAY);
      const period = BigNumber.from(28 * SECONDS_PER_DAY);

      const result = calculateFirstUsableTrancheIndex(now, gracePeriod, period);

      // Expected tranches = (gracePeriod + period) / TRANCHE_DURATION
      const expectedTrancheIndex = Math.floor(((35 + 28) * SECONDS_PER_DAY) / TRANCHE_DURATION);
      expect(result).to.equal(expectedTrancheIndex);
    });

    it('should calculate correct index with maximum values (365 days grace, 365 days period)', () => {
      const now = BigNumber.from(1000000);
      const gracePeriod = BigNumber.from(365 * SECONDS_PER_DAY);
      const period = BigNumber.from(365 * SECONDS_PER_DAY);

      const result = calculateFirstUsableTrancheIndex(now, gracePeriod, period);

      const expectedTrancheIndex = Math.floor(((365 + 365) * SECONDS_PER_DAY) / TRANCHE_DURATION);
      expect(result).to.equal(expectedTrancheIndex);
    });

    it('should handle period of 0', () => {
      const now = BigNumber.from(1000000);
      const gracePeriod = BigNumber.from(35 * SECONDS_PER_DAY);
      const period = BigNumber.from(0);

      const result = calculateFirstUsableTrancheIndex(now, gracePeriod, period);

      const expectedTrancheIndex = Math.floor((35 * SECONDS_PER_DAY) / TRANCHE_DURATION);
      expect(result).to.equal(expectedTrancheIndex);
    });

    it('should handle native number for now parameter', () => {
      const now = 1000000; // number instead of BigNumber
      const gracePeriod = BigNumber.from(35 * SECONDS_PER_DAY);
      const period = BigNumber.from(28 * SECONDS_PER_DAY);

      const result = calculateFirstUsableTrancheIndex(now, gracePeriod, period);

      const expectedTrancheIndex = Math.floor(((35 + 28) * SECONDS_PER_DAY) / TRANCHE_DURATION);
      expect(result).to.equal(expectedTrancheIndex);
    });

    it('should handle BigNumber for period parameter', () => {
      const now = BigNumber.from(1000000);
      const gracePeriod = BigNumber.from(35 * SECONDS_PER_DAY);
      const period = BigNumber.from(28 * SECONDS_PER_DAY); // explicitly testing BigNumber period

      const result = calculateFirstUsableTrancheIndex(now, gracePeriod, period);

      const expectedTrancheIndex = Math.floor(((35 + 28) * SECONDS_PER_DAY) / TRANCHE_DURATION);
      expect(result).to.equal(expectedTrancheIndex);
    });

    it('should handle different timestamps that would result in same tranche', () => {
      const now1 = BigNumber.from(1000000);
      const now2 = BigNumber.from(1000000 + TRANCHE_DURATION - 1);
      const gracePeriod = BigNumber.from(35 * SECONDS_PER_DAY);
      const period = BigNumber.from(28 * SECONDS_PER_DAY);

      const result1 = calculateFirstUsableTrancheIndex(now1, gracePeriod, period);
      const result2 = calculateFirstUsableTrancheIndex(now2, gracePeriod, period);

      expect(result1).to.equal(result2);
    });
  });

  describe('calculateProductDataForTranche', function () {
    const now = BigNumber.from(1000);
    const { assets, assetRates } = mockStore;

    function assertAvailableCapacity(capacityPool, availableInNXM) {
      expect(capacityPool.availableCapacity).to.be.an('array');
      expect(capacityPool.availableCapacity).to.have.lengthOf(Object.keys(assets).length);

      Object.keys(assets).forEach((assetId, index) => {
        const expectedAmount = availableInNXM.mul(assetRates[assetId]).div(WeiPerEther);
        expect(capacityPool.availableCapacity[index].assetId).to.equal(Number(assetId));
        expect(capacityPool.availableCapacity[index].amount.toString()).to.equal(expectedAmount.toString());
        expect(capacityPool.availableCapacity[index].asset).to.deep.equal(assets[assetId]);
      });
    }

    it('should calculate product data correctly for fixed price', function () {
      const product2Pool1 = [mockStore.poolProducts['2_1']]; // Product 2 uses fixed price
      const firstUsableTrancheIndex = 0;
      const [{ allocations, trancheCapacities }] = product2Pool1;

      const { aggregatedData, capacityPerPool } = calculateProductDataForTranche(
        product2Pool1,
        firstUsableTrancheIndex,
        mockStore.products['2'].useFixedPrice,
        now,
        assets,
        assetRates,
      );

      const [capacityPool] = capacityPerPool;
      const lastIndex = allocations.length - 1;

      expect(aggregatedData.capacityUsedNXM.toString()).to.equal(allocations[lastIndex].toString());
      expect(aggregatedData.capacityAvailableNXM.toString()).to.equal(
        trancheCapacities[lastIndex].sub(allocations[lastIndex]).mul(NXM_PER_ALLOCATION_UNIT).toString(),
      );

      expect(capacityPerPool).to.have.lengthOf(1);
      expect(capacityPool.poolId).to.equal(1);
      expect(capacityPool.minAnnualPrice.toString()).to.equal(capacityPool.maxAnnualPrice.toString());
      expect(capacityPool.allocatedNxm.toString()).to.equal(allocations[lastIndex].toString());

      const availableInNXM = trancheCapacities[lastIndex].sub(allocations[lastIndex]).mul(NXM_PER_ALLOCATION_UNIT);
      assertAvailableCapacity(capacityPool, availableInNXM);
    });

    it('should calculate product data correctly for non-fixed price', function () {
      const product0Pool1 = [mockStore.poolProducts['0_1']]; // Product 0 doesn't use fixed price
      const firstUsableTrancheIndex = 0;
      const [{ allocations, trancheCapacities }] = product0Pool1;

      const { aggregatedData, capacityPerPool } = calculateProductDataForTranche(
        product0Pool1,
        firstUsableTrancheIndex,
        mockStore.products['0'].useFixedPrice,
        now,
        assets,
        assetRates,
      );

      const [pool1Capacity] = capacityPerPool;
      const lastIndex = allocations.length - 1;

      expect(aggregatedData.capacityUsedNXM.toString()).to.equal(allocations[lastIndex].toString());
      expect(aggregatedData.capacityAvailableNXM.toString()).to.equal(
        trancheCapacities[lastIndex].sub(allocations[lastIndex]).mul(NXM_PER_ALLOCATION_UNIT).toString(),
      );
      expect(capacityPerPool).to.have.lengthOf(1);
      expect(pool1Capacity.poolId).to.equal(1);
      expect(pool1Capacity.minAnnualPrice.toString()).to.not.equal(pool1Capacity.maxAnnualPrice.toString());

      const availableInNXM = trancheCapacities[lastIndex].sub(allocations[lastIndex]).mul(NXM_PER_ALLOCATION_UNIT);
      assertAvailableCapacity(pool1Capacity, availableInNXM);
    });

    it('should handle zero available capacity', function () {
      const productPools = [
        {
          ...mockStore.poolProducts['0_1'],
          allocations: [...Array(7).fill(Zero), BigNumber.from(9840)],
          trancheCapacities: [...Array(7).fill(Zero), BigNumber.from(9840)],
        },
      ];
      const firstUsableTrancheIndex = 0;

      const { aggregatedData, capacityPerPool } = calculateProductDataForTranche(
        productPools,
        firstUsableTrancheIndex,
        mockStore.products['0'].useFixedPrice,
        now,
        assets,
        assetRates,
      );

      const [pool1Capacity] = capacityPerPool;

      expect(aggregatedData.capacityAvailableNXM.toString()).to.equal('0');
      expect(pool1Capacity.availableCapacity).to.deep.equal([]);
      expect(pool1Capacity.minAnnualPrice.toString()).to.equal('0');
      expect(pool1Capacity.maxAnnualPrice.toString()).to.equal('0');
    });

    it('should calculate product data correctly for multiple pools of the same product', function () {
      const productPools = [mockStore.poolProducts['0_1'], mockStore.poolProducts['0_2']];
      const firstUsableTrancheIndex = 0;

      const { aggregatedData, capacityPerPool } = calculateProductDataForTranche(
        productPools,
        firstUsableTrancheIndex,
        mockStore.products['0'].useFixedPrice,
        now,
        assets,
        assetRates,
      );

      expect(capacityPerPool).to.have.lengthOf(2);

      const [pool1Product0, pool2Product0] = productPools;
      const [pool1Capacity, pool2Capacity] = capacityPerPool;

      const lastIndex1 = pool1Product0.allocations.length - 1;
      const lastIndex2 = pool2Product0.allocations.length - 1;

      // Check aggregated data
      expect(aggregatedData.capacityUsedNXM.toString()).to.equal(
        pool1Product0.allocations[lastIndex1].add(pool2Product0.allocations[lastIndex2]).toString(),
      );
      expect(aggregatedData.capacityAvailableNXM.toString()).to.equal(
        pool1Product0.trancheCapacities[lastIndex1]
          .sub(pool1Product0.allocations[lastIndex1])
          .add(pool2Product0.trancheCapacities[lastIndex2].sub(pool2Product0.allocations[lastIndex2]))
          .mul(NXM_PER_ALLOCATION_UNIT)
          .toString(),
      );

      expect(pool1Capacity.poolId).to.equal(1);
      expect(pool2Capacity.poolId).to.equal(2);

      // Additional checks for each pool
      capacityPerPool.forEach((poolCapacity, index) => {
        expect(poolCapacity.minAnnualPrice.toString()).to.not.equal(poolCapacity.maxAnnualPrice.toString());
        expect(poolCapacity.availableCapacity.length).to.not.equal(0);

        const { allocations, trancheCapacities } = productPools[index];
        const lastIndex = allocations.length - 1;
        const availableInNXM = trancheCapacities[lastIndex].sub(allocations[lastIndex]).mul(NXM_PER_ALLOCATION_UNIT);
        assertAvailableCapacity(poolCapacity, availableInNXM);
      });
    });
  });

  describe('calculateAvailableCapacity', () => {
    const trancheCapacities = [BigNumber.from(100), BigNumber.from(200), BigNumber.from(300), BigNumber.from(400)];
    const allocations = [BigNumber.from(50), BigNumber.from(150), BigNumber.from(250), BigNumber.from(350)];

    it('should calculate available capacity correctly with firstUsableTrancheIndex = 0', () => {
      const firstUsableTrancheIndex = 0;
      const result = calculateAvailableCapacity(trancheCapacities, allocations, firstUsableTrancheIndex);

      // Expected: sum of all (capacity - allocation) = (50 + 50 + 50 + 50) = 200
      expect(result.toString()).to.equal('200');
    });

    it('should calculate available capacity correctly with firstUsableTrancheIndex > 0', () => {
      const firstUsableTrancheIndex = 2;
      const result = calculateAvailableCapacity(trancheCapacities, allocations, firstUsableTrancheIndex);

      // Expected: only tranches 2 and 3: (50 + 50) = 100
      expect(result.toString()).to.equal('100');
    });

    it('should handle negative differences before firstUsableTrancheIndex', () => {
      const overAllocated = [
        BigNumber.from(150), // over by 50
        BigNumber.from(250), // over by 50
        BigNumber.from(250),
        BigNumber.from(350),
      ];
      const firstUsableTrancheIndex = 2;
      const result = calculateAvailableCapacity(trancheCapacities, overAllocated, firstUsableTrancheIndex);

      // Expected: carry over negative (-100) and add tranches 2,3: (50 + 50 - 100) = 0
      expect(result.toString()).to.equal('0');
    });

    it('should return zero when all capacity is allocated', () => {
      const fullAllocations = trancheCapacities.map(c => c);
      const firstUsableTrancheIndex = 0;
      const result = calculateAvailableCapacity(trancheCapacities, fullAllocations, firstUsableTrancheIndex);

      expect(result.toString()).to.equal('0');
    });

    it('should handle empty arrays', () => {
      const firstUsableTrancheIndex = 0;
      const result = calculateAvailableCapacity([], [], firstUsableTrancheIndex);

      expect(result.toString()).to.equal('0');
    });
  });
});
