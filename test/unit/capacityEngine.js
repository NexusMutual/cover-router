const { expect } = require('chai');
const ethers = require('ethers');
const sinon = require('sinon');

const { capacities, poolProductCapacities } = require('./responses');
const {
  capacityEngine,
  getUtilizationRate,
  calculateFirstUsableTrancheForMaxPeriodIndex,
  getProductsInPool,
} = require('../../src/lib/capacityEngine');
const { NXM_PER_ALLOCATION_UNIT } = require('../../src/lib/constants');
const {
  calculateTrancheId,
  calculateAvailableCapacity,
  calculateProductDataForTranche,
  bnMax,
} = require('../../src/lib/helpers');
const { selectAsset } = require('../../src/store/selectors');
const mockStore = require('../mocks/store');

const { BigNumber } = ethers;
const { parseEther } = ethers.utils;
const { Zero } = ethers.constants;
const { assets, assetRates } = mockStore;

describe('Capacity Engine tests', function () {
  describe('capacityEngine', function () {
    const store = { getState: () => null };

    beforeEach(function () {
      sinon.stub(store, 'getState').callsFake(() => mockStore);
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should return capacity for all products when no productIds or poolId are provided', function () {
      const response = capacityEngine(store, { period: 30 });

      expect(response).to.have.lengthOf(Object.keys(mockStore.products).length);

      response.forEach((product, i) => {
        expect(product.productId).to.be.equal(capacities[i].productId);
        expect(product.utilizationRate.toNumber()).to.be.equal(capacities[i].utilizationRate);

        product.availableCapacity.forEach(({ assetId, amount, asset }, j) => {
          expect(amount.toString()).to.be.equal(capacities[i].availableCapacity[j].amount);
          expect(asset).to.deep.equal(selectAsset(store, assetId));
        });
      });
    });

    it('should return capacity for 1 product across all pools if productId is provided and poolId is not', function () {
      const productId = '0';
      const [product] = capacityEngine(store, { productIds: [productId] });

      const expectedCapacity = capacities[Number(productId)];

      expect(product.productId).to.be.equal(expectedCapacity.productId);
      expect(product.utilizationRate.toNumber()).to.be.equal(expectedCapacity.utilizationRate);

      product.availableCapacity.forEach(({ assetId, amount, asset }, i) => {
        expect(amount.toString()).not.to.be.equal(expectedCapacity.availableCapacity[i]);
        expect(asset).to.deep.equal(selectAsset(store, assetId));
      });
    });

    it('should return undefined for non-existing product', function () {
      const nonExistingProductId = '999';
      const [product] = capacityEngine(store, { productIds: [nonExistingProductId] });
      expect(product).to.be.equal(undefined);
    });

    it('should return capacity for a specific product and pool if both productId and poolId are provided', function () {
      const productId = '0';
      const poolId = 2;
      const [product] = capacityEngine(store, { poolId, productIds: [productId] });

      const expectedCapacity = poolProductCapacities[poolId].find(c => c.productId === Number(productId));

      expect(product.productId).to.equal(Number(productId));
      expect(product.usedCapacity.toString()).to.equal(expectedCapacity.allocatedNxm);
      expect(product.utilizationRate.toNumber()).to.be.equal(expectedCapacity.utilizationRate);
      expect(product.minAnnualPrice.toString()).to.equal(parseEther(expectedCapacity.minAnnualPrice).toString());
      expect(product.maxAnnualPrice.toString()).to.equal(parseEther(expectedCapacity.maxAnnualPrice).toString());
      expect(product.availableCapacity).to.have.lengthOf(expectedCapacity.availableCapacity.length);

      product.availableCapacity.forEach(({ assetId, amount, asset }, i) => {
        expect(amount.toString()).to.be.equal(expectedCapacity.availableCapacity[i].amount);
        expect(asset).to.deep.equal(selectAsset(store, assetId));
      });
    });

    it('should return capacities for all products in a specific pool when only poolId is provided', function () {
      const poolId = 2;
      const response = capacityEngine(store, { poolId });

      expect(response.length).to.be.greaterThan(0);

      response.forEach(product => {
        const expectedCapacity = poolProductCapacities[poolId].find(c => c.productId === product.productId);
        const productPools = mockStore.productPoolIds[product.productId];
        expect(productPools).to.include(poolId);
        expect(product.usedCapacity.toString()).to.equal(expectedCapacity.allocatedNxm);
        expect(product.utilizationRate.toNumber()).to.be.equal(expectedCapacity.utilizationRate);
        expect(product.minAnnualPrice.toString()).to.equal(parseEther(expectedCapacity.minAnnualPrice).toString());
        expect(product.maxAnnualPrice.toString()).to.equal(parseEther(expectedCapacity.maxAnnualPrice).toString());
        expect(product.availableCapacity).to.have.lengthOf(expectedCapacity.availableCapacity.length);

        product.availableCapacity.forEach(({ assetId, amount, asset }, i) => {
          expect(amount.toString()).to.be.equal(expectedCapacity.availableCapacity[i].amount);
          expect(asset).to.deep.equal(selectAsset(store, assetId));
        });
      });
    });

    it('should return the same total capacity for a product across all pools as when poolId is not given', function () {
      const productId = '0';
      const poolIds = mockStore.productPoolIds[productId];

      // Get capacity for product 0 across all pools
      const [allPoolsProduct] = capacityEngine(store, { productIds: [productId] });

      const initObject = {
        productId: Number(productId),
        usedCapacity: BigNumber.from(0),
        minAnnualPrice: BigNumber.from(0),
        maxAnnualPrice: BigNumber.from(0),
        availableCapacity: [],
      };

      // Get capacity for product 0 for each pool and sum them up
      const summedCapacity = poolIds.reduce((acc, poolId) => {
        const [product] = capacityEngine(store, { poolId: Number(poolId), productIds: [productId] });

        if (!product) {
          return acc;
        }

        // Sum up all numeric fields
        acc.usedCapacity = acc.usedCapacity.add(product.usedCapacity);
        acc.minAnnualPrice = acc.minAnnualPrice.gt(product.minAnnualPrice)
          ? acc.minAnnualPrice
          : product.minAnnualPrice;
        acc.maxAnnualPrice = acc.maxAnnualPrice.gt(product.maxAnnualPrice)
          ? acc.maxAnnualPrice
          : product.maxAnnualPrice;

        // Sum up availableCapacity for each asset
        product.availableCapacity.forEach((capacity, index) => {
          if (!acc.availableCapacity[index]) {
            acc.availableCapacity[index] = { ...capacity, amount: BigNumber.from(0) };
          }
          acc.availableCapacity[index].amount = acc.availableCapacity[index].amount.add(capacity.amount);
        });

        return acc;
      }, initObject);

      // Assert that all fields match
      const capacityAvailableNXM = summedCapacity.availableCapacity.find(c => c.assetId === 255)?.amount;
      const utilizationRate = getUtilizationRate(capacityAvailableNXM, summedCapacity.usedCapacity);
      expect(summedCapacity.productId).to.equal(allPoolsProduct.productId);
      expect(summedCapacity.usedCapacity.toString()).to.equal(allPoolsProduct.usedCapacity.toString());
      expect(utilizationRate.toNumber()).to.be.equal(allPoolsProduct.utilizationRate.toNumber());
      expect(summedCapacity.minAnnualPrice.toString()).to.equal(allPoolsProduct.minAnnualPrice.toString());
      expect(summedCapacity.maxAnnualPrice.toString()).to.equal(allPoolsProduct.maxAnnualPrice.toString());

      // Assert that availableCapacity matches for each asset
      expect(summedCapacity.availableCapacity.length).to.equal(allPoolsProduct.availableCapacity.length);
      summedCapacity.availableCapacity.forEach((capacity, index) => {
        expect(capacity.amount.toString()).to.equal(allPoolsProduct.availableCapacity[index].amount.toString());
        expect(capacity.assetId).to.equal(allPoolsProduct.availableCapacity[index].assetId);
        expect(capacity.asset).to.deep.equal(allPoolsProduct.availableCapacity[index].asset);
      });
    });

    it('should handle products with fixed price correctly', function () {
      const fixedPricedProductId = '2';
      const [product] = capacityEngine(store, { productIds: [fixedPricedProductId] });

      expect(product.productId).to.equal(Number(fixedPricedProductId));
      expect(product.minAnnualPrice).to.deep.equal(product.maxAnnualPrice);
    });

    it('should handle products without fixed price correctly', function () {
      const nonFixedPricedProductId = '0';
      const [product] = capacityEngine(store, { productIds: [nonFixedPricedProductId] });

      expect(product.productId).to.equal(Number(nonFixedPricedProductId));
      expect(product.minAnnualPrice).to.not.deep.equal(product.maxAnnualPrice);
    });

    it('should not include capacityPerPool when withPools is false', function () {
      const productId = '0';
      const [productWithoutPools] = capacityEngine(store, { productIds: [productId], withPools: false });
      expect(productWithoutPools).to.not.have.property('capacityPerPool');
    });

    it('should include capacityPerPool if query param withPool=true', function () {
      const productId = '0';

      const [productWithPools] = capacityEngine(store, { productIds: [productId], withPools: true });
      expect(productWithPools).to.have.property('capacityPerPool');

      // Sum up values from capacityPerPool
      const initCapacity = { usedCapacity: Zero, availableCapacity: {}, minAnnualPrice: Zero, maxAnnualPrice: Zero };
      const summedCapacity = productWithPools.capacityPerPool.reduce((acc, pool) => {
        acc.usedCapacity = acc.usedCapacity.add(pool.allocatedNxm);
        acc.maxAnnualPrice = bnMax(acc.maxAnnualPrice, pool.maxAnnualPrice);

        // skip poolId 3 as there is 0 available capacity
        if (pool.poolId !== 3 && (acc.minAnnualPrice.isZero() || pool.minAnnualPrice.lt(acc.minAnnualPrice))) {
          acc.minAnnualPrice = pool.minAnnualPrice;
        }

        pool.availableCapacity.forEach(asset => {
          acc.availableCapacity[asset.assetId] = (acc.availableCapacity[asset.assetId] ?? Zero).add(asset.amount);
        });

        return acc;
      }, initCapacity);

      // Compare summed values with root-level (across all pools) values
      expect(summedCapacity.usedCapacity.toString()).to.equal(productWithPools.usedCapacity.toString());
      expect(summedCapacity.minAnnualPrice.toString()).to.equal(productWithPools.minAnnualPrice.toString());
      expect(summedCapacity.maxAnnualPrice.toString()).to.equal(productWithPools.maxAnnualPrice.toString());

      productWithPools.availableCapacity.forEach(asset => {
        expect(summedCapacity.availableCapacity[asset.assetId].toString()).to.equal(asset.amount.toString());
      });
    });

    it('should have root-level (across all pools) prices within range of pool prices', function () {
      const productId = '0';
      const [productWithPools] = capacityEngine(store, { productIds: [productId], withPools: true });

      const poolPrices = productWithPools.capacityPerPool
        .filter(pool => pool.poolId !== 3) // skip poolId 3 as there is 0 available capacity
        .map(pool => ({
          min: pool.minAnnualPrice,
          max: pool.maxAnnualPrice,
        }));

      expect(productWithPools.minAnnualPrice.toString()).to.equal(Math.min(...poolPrices.map(p => p.min)).toString());
      expect(productWithPools.maxAnnualPrice.toString()).to.equal(Math.max(...poolPrices.map(p => p.max)).toString());
    });
  });

  describe('getUtilizationRate tests', function () {
    it('should calculate utilization rate correctly when there is available capacity', function () {
      const capacityAvailableNXM = parseEther('100');
      const capacityUsedNXM = parseEther('50');

      const utilizationRate = getUtilizationRate(capacityAvailableNXM, capacityUsedNXM);

      const expectedRate = BigNumber.from(3333); // (50 / (100 + 50)) * 10000 = 3333 basis points

      expect(utilizationRate.toNumber()).to.be.closeTo(expectedRate.toNumber(), 1);
    });

    it('should return 1 when ALL capacity is used (no available capacity)', function () {
      const capacityAvailableNXM = Zero;
      const capacityUsedNXM = parseEther('150');

      const utilizationRate = getUtilizationRate(capacityAvailableNXM, capacityUsedNXM);

      expect(utilizationRate.toNumber()).to.equal(10000);
    });

    it('should return undefined if utilizationRate cannot be calculated because of missing data', function () {
      const capacityAvailableNXM = undefined;
      const capacityUsedNXM = parseEther('50');

      const utilizationRate = getUtilizationRate(capacityAvailableNXM, capacityUsedNXM);

      expect(utilizationRate).to.equal(undefined);
    });

    it('should return undefined when there is no capacity available', function () {
      const capacityAvailableNXM = Zero;
      const capacityUsedNXM = Zero;

      const utilizationRate = getUtilizationRate(capacityAvailableNXM, capacityUsedNXM);

      expect(utilizationRate.toNumber()).to.equal(0);
    });
  });

  describe('calculateAvailableCapacity', function () {
    it('should calculate available capacity correctly when all tranches are usable', function () {
      const trancheCapacities = [BigNumber.from(100), BigNumber.from(200), BigNumber.from(300)];
      const allocations = [BigNumber.from(50), BigNumber.from(100), BigNumber.from(150)];
      const firstUsableTrancheIndex = 0;

      const result = calculateAvailableCapacity(trancheCapacities, allocations, firstUsableTrancheIndex);

      expect(result.toString()).to.equal('300'); // (100-50) + (200-100) + (300-150) = 300
    });

    it('should handle unusable tranches correctly', function () {
      const trancheCapacities = [BigNumber.from(100), BigNumber.from(200), BigNumber.from(300)];
      const allocations = [BigNumber.from(50), BigNumber.from(100), BigNumber.from(150)];
      const firstUsableTrancheIndex = 1;

      const result = calculateAvailableCapacity(trancheCapacities, allocations, firstUsableTrancheIndex);

      expect(result.toString()).to.equal('250'); // 0 + (200-100) + (300-150) = 250
    });

    it('should carry over negative values on unusable tranches', function () {
      const trancheCapacities = [BigNumber.from(100), BigNumber.from(200), BigNumber.from(300)];
      const allocations = [BigNumber.from(150), BigNumber.from(100), BigNumber.from(150)];
      const firstUsableTrancheIndex = 1;

      const result = calculateAvailableCapacity(trancheCapacities, allocations, firstUsableTrancheIndex);

      expect(result.toString()).to.equal('200'); // -50 + (200-100) + (300-150) = 200
    });

    it('should return zero when all capacity is allocated', function () {
      const trancheCapacities = [BigNumber.from(100), BigNumber.from(200)];
      const allocations = [BigNumber.from(100), BigNumber.from(200)];
      const firstUsableTrancheIndex = 0;

      const result = calculateAvailableCapacity(trancheCapacities, allocations, firstUsableTrancheIndex);

      expect(result.toString()).to.equal('0');
    });

    it('should handle empty arrays', function () {
      const trancheCapacities = [];
      const allocations = [];
      const firstUsableTrancheIndex = 0;

      const result = calculateAvailableCapacity(trancheCapacities, allocations, firstUsableTrancheIndex);

      expect(result.toString()).to.equal('0');
    });

    it('should handle case where allocations exceed capacities', function () {
      const trancheCapacities = [BigNumber.from(100), BigNumber.from(200)];
      const allocations = [BigNumber.from(150), BigNumber.from(250)];
      const firstUsableTrancheIndex = 0;

      const result = calculateAvailableCapacity(trancheCapacities, allocations, firstUsableTrancheIndex);

      expect(result.toString()).to.equal('0');
    });
  });

  describe('calculateProductDataForTranche', function () {
    const now = BigNumber.from(1000);

    function assertAvailableCapacity(capacityPool, availableInNXM) {
      expect(capacityPool.availableCapacity).to.be.an('array');
      expect(capacityPool.availableCapacity).to.have.lengthOf(Object.keys(assets).length);

      Object.keys(assets).forEach((assetId, index) => {
        const expectedAmount = availableInNXM.mul(assetRates[assetId]).div(BigNumber.from(10).pow(18));
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

  describe('getProductsInPool', function () {
    let mockStore;

    beforeEach(function () {
      mockStore = {
        getState: sinon.stub(),
      };
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should return correct product IDs for a given pool', function () {
      mockStore.getState.returns({
        products: { 1: {}, 2: {}, 3: {} },
        productPoolIds: { 1: [1, 2], 2: [2], 3: [1, 2] },
        poolProducts: { '1_2': { poolId: 2 }, '2_2': { poolId: 2 }, '3_2': { poolId: 2 } },
      });

      const poolId = 2;
      const result = getProductsInPool(mockStore, poolId);

      expect(result).to.deep.equal(['1', '2', '3']);
    });

    it('should return an empty array for a pool with no products', function () {
      mockStore.getState.returns({
        products: { 1: {}, 2: {}, 3: {} },
        productPoolIds: { 1: [1], 2: [1], 3: [1] },
        poolProducts: { '1_1': { poolId: 1 }, '2_1': { poolId: 1 }, '3_1': { poolId: 1 } },
      });

      const poolId = 2;
      const result = getProductsInPool(mockStore, poolId);

      expect(result).to.deep.equal([]);
    });

    it('should handle undefined productPools', function () {
      mockStore.getState.returns({
        products: { 1: {}, 2: {}, 3: {} },
        productPoolIds: {},
        poolProducts: {},
      });

      const poolId = 2;
      const result = getProductsInPool(mockStore, poolId);

      expect(result).to.deep.equal([]);
    });
  });

  describe('calculateFirstUsableTrancheForMaxPeriodIndex', function () {
    const SECONDS_PER_DAY = 24 * 60 * 60;
    const MAX_COVER_PERIOD = BigNumber.from(365 * SECONDS_PER_DAY);

    it('should calculate index correctly for minimum grace period', function () {
      const now = BigNumber.from(1000);
      const gracePeriod = BigNumber.from(35 * SECONDS_PER_DAY);

      const result = calculateFirstUsableTrancheForMaxPeriodIndex(now, gracePeriod);

      const firstActiveTrancheId = calculateTrancheId(now);
      const expectedTrancheId = calculateTrancheId(now.add(MAX_COVER_PERIOD).add(gracePeriod));
      expect(result).to.equal(expectedTrancheId - firstActiveTrancheId);
    });

    it('should calculate index correctly for maximum grace period', function () {
      const now = BigNumber.from(1000);
      const gracePeriod = BigNumber.from(365 * SECONDS_PER_DAY);

      const result = calculateFirstUsableTrancheForMaxPeriodIndex(now, gracePeriod);

      const firstActiveTrancheId = calculateTrancheId(now);
      const expectedTrancheId = calculateTrancheId(now.add(MAX_COVER_PERIOD).add(gracePeriod));
      expect(result).to.equal(expectedTrancheId - firstActiveTrancheId);
    });
  });
});
