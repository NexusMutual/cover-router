const { expect } = require('chai');
const ethers = require('ethers');
const sinon = require('sinon');

const { poolProductCapacities } = require('./responses');
const {
  calculateExpectedUsedCapacity,
  getCurrentTimestamp,
  verifyPriceCalculations,
  verifyCapacityResponse,
} = require('./utils');
const {
  getAllProductCapacities,
  getProductCapacity,
  getPoolCapacity,
  getProductCapacityInPool,
  getUtilizationRate,
  calculateFirstUsableTrancheForMaxPeriodIndex,
  getProductsInPool,
  calculatePoolUtilizationRate,
  calculateProductCapacity,
} = require('../../src/lib/capacityEngine');
const { MAX_COVER_PERIOD, SECONDS_PER_DAY, NXM_PER_ALLOCATION_UNIT } = require('../../src/lib/constants');
const {
  calculateAvailableCapacity,
  calculateBasePrice,
  calculateFirstUsableTrancheIndex,
  calculateFixedPricePremiumPerYear,
  calculatePremiumPerYear,
  calculateProductDataForTranche,
  calculateTrancheId,
} = require('../../src/lib/helpers');
const mockStore = require('../mocks/store');

const { BigNumber } = ethers;
const { parseEther } = ethers.utils;
const { Zero, WeiPerEther } = ethers.constants;

const verifyPoolCapacity = (poolCapacity, productId, products, poolProducts, now) => {
  const poolProduct = poolProducts[`${productId}_${poolCapacity.poolId}`];
  expect(poolProduct).to.not.equal(undefined);

  // Calculate first usable tranche index
  const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(
    now,
    products[productId].gracePeriod,
    SECONDS_PER_DAY.mul(30),
  );

  // Calculate available capacity considering all usable tranches
  const availableCapacity = calculateAvailableCapacity(
    poolProduct.trancheCapacities,
    poolProduct.allocations,
    firstUsableTrancheIndex,
  );

  // Check pool-specific capacity
  const nxmCapacityAmount = poolCapacity.availableCapacity.find(c => c.assetId === 255)?.amount || Zero;
  expect(nxmCapacityAmount.toString()).to.equal(availableCapacity.mul(NXM_PER_ALLOCATION_UNIT).toString());

  // Check pool-specific used capacity
  const poolUsedCapacity = poolProduct.allocations.reduce((sum, alloc) => sum.add(alloc), Zero);
  expect(poolCapacity.allocatedNxm.toString()).to.equal(poolUsedCapacity.mul(NXM_PER_ALLOCATION_UNIT).toString());
};

describe('Capacity Engine tests', function () {
  const store = { getState: () => null };

  beforeEach(function () {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('calculateProductCapacity', function () {
    const { assets, assetRates } = mockStore;
    const now = getCurrentTimestamp();

    // Add these new verification functions
    const verifyCapacityAsset = (capacity, nxmCapacity, assets, assetRates) => {
      expect(capacity.asset).to.deep.equal(assets[capacity.assetId]);

      if (capacity.assetId !== 255) {
        const expectedAmount = nxmCapacity.mul(assetRates[capacity.assetId]).div(WeiPerEther);
        expect(capacity.amount.toString()).to.equal(expectedAmount.toString());
      }
    };

    const verifyPoolCapacityWithAssets = (poolCapacity, productId, poolProducts) => {
      const poolProduct = poolProducts[`${productId}_${poolCapacity.poolId}`];
      const nxmCapacity = poolCapacity.availableCapacity.find(c => c.assetId === 255)?.amount || Zero;

      poolCapacity.availableCapacity.forEach(capacity =>
        verifyCapacityAsset(capacity, nxmCapacity, assets, assetRates),
      );

      const expectedAllocatedNxm = poolProduct.allocations
        .reduce((sum, alloc) => sum.add(alloc), Zero)
        .mul(NXM_PER_ALLOCATION_UNIT);
      expect(poolCapacity.allocatedNxm.toString()).to.equal(expectedAllocatedNxm.toString());
    };

    // Common verification functions
    const verifyNXMCapacity = (nxmCapacity, expectedAmount) => {
      const amount = nxmCapacity?.amount || Zero;
      expect(amount.toString()).to.equal(expectedAmount.toString());
      if (nxmCapacity) {
        expect(nxmCapacity.asset).to.deep.equal(assets[255]);
      }
    };

    const calculatePoolCapacity = (poolProduct, firstUsableTrancheIndex = 0) => {
      return calculateAvailableCapacity(
        poolProduct.trancheCapacities,
        poolProduct.allocations,
        firstUsableTrancheIndex,
      ).mul(NXM_PER_ALLOCATION_UNIT);
    };

    it('should calculate product capacity correctly', function () {
      const productId = '0';
      const { poolProducts } = store.getState();

      const response = calculateProductCapacity(store, productId, {
        periodSeconds: SECONDS_PER_DAY.mul(30),
        now,
        assets,
        assetRates,
      });

      expect(response.productId).to.equal(0);
      expect(response.availableCapacity).to.be.an('array');

      const pool1Capacity = calculatePoolCapacity(poolProducts['0_1']);
      const pool2Capacity = calculatePoolCapacity(poolProducts['0_2']);
      const totalCapacity = pool1Capacity.add(pool2Capacity);

      const nxmCapacity = response.availableCapacity.find(c => c.assetId === 255);
      verifyNXMCapacity(nxmCapacity, totalCapacity);
    });

    it('should handle fixed price products correctly', function () {
      const product2Pool1 = [mockStore.poolProducts['2_1']]; // Product 2 uses fixed price
      const firstUsableTrancheIndex = 0;
      const [{ allocations, trancheCapacities, targetPrice }] = product2Pool1;
      const lastIndex = allocations.length - 1;

      const { aggregatedData, capacityPerPool } = calculateProductDataForTranche(
        product2Pool1,
        firstUsableTrancheIndex,
        mockStore.products['2'].useFixedPrice,
        now,
        assets,
        assetRates,
      );

      const [capacityPool] = capacityPerPool;

      // Calculate expected fixed price
      const used = allocations[lastIndex].mul(NXM_PER_ALLOCATION_UNIT);
      const availableCapacity = trancheCapacities[lastIndex].sub(allocations[lastIndex]);
      const availableInNXM = availableCapacity.mul(NXM_PER_ALLOCATION_UNIT);
      const expectedFixedPrice = WeiPerEther.mul(
        calculateFixedPricePremiumPerYear(NXM_PER_ALLOCATION_UNIT, targetPrice),
      ).div(NXM_PER_ALLOCATION_UNIT);

      expect(aggregatedData.capacityUsedNXM.toString()).to.equal(used.toString());
      expect(aggregatedData.capacityAvailableNXM.toString()).to.equal(availableInNXM.toString());
      expect(aggregatedData.minPrice.toString()).to.equal(expectedFixedPrice.toString());
      expect(aggregatedData.totalPremium.toString()).to.equal(
        calculateFixedPricePremiumPerYear(availableInNXM, targetPrice).toString(),
      );

      expect(capacityPerPool).to.have.lengthOf(1);
      expect(capacityPool.poolId).to.equal(1);
      expect(capacityPool.minAnnualPrice.toString()).to.equal(expectedFixedPrice.toString());
      expect(capacityPool.maxAnnualPrice.toString()).to.equal(expectedFixedPrice.toString());
      expect(capacityPool.allocatedNxm.toString()).to.equal(used.toString());
    });

    it('should handle non-fixed price products correctly', function () {
      const { poolProducts } = store.getState();
      const productPool = [mockStore.poolProducts['0_1']];
      const [{ allocations, trancheCapacities, targetPrice, bumpedPrice, bumpedPriceUpdateTime }] = productPool;
      const lastIndex = allocations.length - 1;

      const response = calculateProductCapacity(store, '0', {
        periodSeconds: SECONDS_PER_DAY.mul(30),
        now,
        assets,
        assetRates,
        withPools: true,
      });

      // Calculate expected values
      const used = allocations[lastIndex].mul(NXM_PER_ALLOCATION_UNIT);
      const availableCapacity = trancheCapacities[lastIndex].sub(allocations[lastIndex]);
      const availableInNXM = availableCapacity.mul(NXM_PER_ALLOCATION_UNIT);
      const total = trancheCapacities[lastIndex].mul(NXM_PER_ALLOCATION_UNIT);

      // Calculate base price
      const basePrice = calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

      // Calculate expected min annual price
      const minPremiumPerYear = calculatePremiumPerYear(NXM_PER_ALLOCATION_UNIT, basePrice, used, total);
      const expectedMinPrice = WeiPerEther.mul(minPremiumPerYear).div(NXM_PER_ALLOCATION_UNIT);

      // Calculate expected max annual price
      const maxPremiumPerYear = calculatePremiumPerYear(availableInNXM, basePrice, used, total);
      const expectedMaxPrice = availableInNXM.isZero() ? Zero : WeiPerEther.mul(maxPremiumPerYear).div(availableInNXM);

      expect(response.minAnnualPrice.toString()).to.equal(expectedMinPrice.toString());
      expect(response.maxAnnualPrice.toString()).to.equal(expectedMaxPrice.toString());
      expect(response.minAnnualPrice.toString()).to.not.equal(response.maxAnnualPrice.toString());
      expect(response.minAnnualPrice.lt(response.maxAnnualPrice)).to.equal(true);

      response.capacityPerPool.forEach(poolCapacity => verifyPoolCapacityWithAssets(poolCapacity, '0', poolProducts));
    });

    it('should include capacityPerPool when withPools is true', function () {
      const now = getCurrentTimestamp();
      const productId = '0';
      const { products, poolProducts } = store.getState();
      const response = calculateProductCapacity(store, productId, {
        periodSeconds: SECONDS_PER_DAY.mul(30),
        withPools: true,
        now,
        assets,
        assetRates,
      });

      response.capacityPerPool.forEach(poolCapacity =>
        verifyPoolCapacity(poolCapacity, productId, products, poolProducts, now),
      );
    });

    it('should filter by poolId when provided', function () {
      const productId = '0';
      const poolId = 2;
      const now = getCurrentTimestamp();
      const response = calculateProductCapacity(store, productId, {
        poolId,
        periodSeconds: SECONDS_PER_DAY.mul(30),
        now,
        assets: mockStore.assets,
        assetRates: mockStore.assetRates,
      });

      const { availableCapacity } = poolProductCapacities[poolId].productsCapacity.find(
        p => p.productId === Number(productId),
      );
      const expectedAvailableCapacity = availableCapacity.map(cap => ({
        ...cap,
        amount: BigNumber.from(cap.amount),
      }));

      expect(response.availableCapacity).to.deep.equal(expectedAvailableCapacity);
    });

    it('should return null for non-existing product', function () {
      const nonExistingProductId = '999';
      const now = getCurrentTimestamp();
      const response = calculateProductCapacity(store, nonExistingProductId, {
        periodSeconds: SECONDS_PER_DAY.mul(30),
        now,
        assets: mockStore.assets,
        assetRates: mockStore.assetRates,
      });

      expect(response).to.equal(null);
    });

    it('should handle zero capacity correctly', function () {
      const productId = '0';
      const zeroCapacityStore = {
        getState: () => ({
          ...mockStore,
          poolProducts: {
            '0_1': {
              ...mockStore.poolProducts['0_1'],
              trancheCapacities: Array(8).fill(Zero),
              allocations: Array(8).fill(Zero),
              targetPrice: Zero,
              bumpedPrice: Zero,
              bumpedPriceUpdateTime: Zero,
            },
          },
          productPoolIds: { 0: [1] }, // Only pool 1 for product 0
        }),
      };

      const response = calculateProductCapacity(zeroCapacityStore, productId, {
        periodSeconds: SECONDS_PER_DAY.mul(30),
        now,
        assets,
        assetRates,
      });

      const nxmCapacity = response.availableCapacity.find(c => c.assetId === 255);
      verifyNXMCapacity(nxmCapacity, Zero);
      expect(response.maxAnnualPrice.toString()).to.equal('0');
    });

    it('should calculate capacity across multiple tranches for non-fixed price products', function () {
      const productId = '1'; // Non-fixed price product
      const now = getCurrentTimestamp();
      const response = calculateProductCapacity(store, productId, {
        periodSeconds: SECONDS_PER_DAY.mul(7), // 1 week
        now,
        assets: mockStore.assets,
        assetRates: mockStore.assetRates,
      });

      // Calculate expected values
      const pool1Product = mockStore.poolProducts['1_1'];
      const pool2Product = mockStore.poolProducts['1_2'];

      // Calculate base prices for each pool
      const basePrice1 = calculateBasePrice(
        pool1Product.targetPrice,
        pool1Product.bumpedPrice,
        pool1Product.bumpedPriceUpdateTime,
        now,
      );
      const basePrice2 = calculateBasePrice(
        pool2Product.targetPrice,
        pool2Product.bumpedPrice,
        pool2Product.bumpedPriceUpdateTime,
        now,
      );

      // Get total capacity and used capacity for each pool
      const totalCapacity1 = pool1Product.trancheCapacities[7].mul(NXM_PER_ALLOCATION_UNIT);
      const totalCapacity2 = pool2Product.trancheCapacities[8].mul(NXM_PER_ALLOCATION_UNIT);
      const usedCapacity1 = pool1Product.allocations[7].mul(NXM_PER_ALLOCATION_UNIT);
      const usedCapacity2 = pool2Product.allocations[8].mul(NXM_PER_ALLOCATION_UNIT);

      // Calculate min premium (for 1 unit)
      const minPremium1 = calculatePremiumPerYear(NXM_PER_ALLOCATION_UNIT, basePrice1, usedCapacity1, totalCapacity1);
      const minPremium2 = calculatePremiumPerYear(NXM_PER_ALLOCATION_UNIT, basePrice2, usedCapacity2, totalCapacity2);

      // Expected min price is the minimum of the two pools
      const expectedMinPrice = WeiPerEther.mul(minPremium1.lt(minPremium2) ? minPremium1 : minPremium2).div(
        NXM_PER_ALLOCATION_UNIT,
      );

      // Calculate max premium (for all available capacity)
      const availableCapacity1 = totalCapacity1.sub(usedCapacity1);
      const availableCapacity2 = totalCapacity2.sub(usedCapacity2);
      const maxPremium1 = calculatePremiumPerYear(availableCapacity1, basePrice1, usedCapacity1, totalCapacity1);
      const maxPremium2 = calculatePremiumPerYear(availableCapacity2, basePrice2, usedCapacity2, totalCapacity2);

      // Expected max price is the maximum premium per unit
      const maxPrice1 = availableCapacity1.isZero() ? Zero : WeiPerEther.mul(maxPremium1).div(availableCapacity1);
      const maxPrice2 = availableCapacity2.isZero() ? Zero : WeiPerEther.mul(maxPremium2).div(availableCapacity2);
      const expectedMaxPrice = maxPrice1.gt(maxPrice2) ? maxPrice1 : maxPrice2;

      // Verify prices
      expect(response.minAnnualPrice.toString()).to.equal(expectedMinPrice.toString());
      expect(response.maxAnnualPrice.toString()).to.equal(expectedMaxPrice.toString());
      expect(response.minAnnualPrice).to.not.deep.equal(response.maxAnnualPrice);
      expect(response.maxAnnualPrice).to.not.deep.equal(Zero);
    });
  });

  describe('getAllProductCapacities', function () {
    const now = getCurrentTimestamp();

    const verifyProductCapacity = (product, storeProduct, poolIds, poolProducts, assets) => {
      expect(storeProduct).to.not.equal(undefined);

      const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(
        now,
        storeProduct.gracePeriod,
        SECONDS_PER_DAY.mul(30),
      );

      const expectedAvailableNXM = poolIds.reduce((total, poolId) => {
        const poolProduct = poolProducts[`${product.productId}_${poolId}`];
        const availableCapacity = calculateAvailableCapacity(
          poolProduct.trancheCapacities,
          poolProduct.allocations,
          firstUsableTrancheIndex,
        );
        return total.add(availableCapacity.mul(NXM_PER_ALLOCATION_UNIT));
      }, Zero);

      const nxmCapacity = product.availableCapacity.find(c => c.assetId === 255);
      expect(nxmCapacity.amount.toString()).to.equal(expectedAvailableNXM.toString());
      expect(nxmCapacity.asset).to.deep.equal(assets[255]);

      const expectedUsedCapacity = poolIds.reduce((total, poolId) => {
        const poolProduct = poolProducts[`${product.productId}_${poolId}`];
        const usedCapacity = poolProduct.allocations.reduce((sum, alloc) => sum.add(alloc), Zero);
        return total.add(usedCapacity.mul(NXM_PER_ALLOCATION_UNIT));
      }, Zero);

      expect(product.usedCapacity.toString()).to.equal(expectedUsedCapacity.toString());
    };
    it('should return capacity for all products across all pools', function () {
      const response = getAllProductCapacities(store);
      const { products, productPoolIds, poolProducts, assets } = store.getState();

      // Should return all products from store
      expect(response).to.have.lengthOf(Object.keys(products).length);

      // Check each product's capacity data
      response.forEach(product => {
        const { productId } = product;
        verifyProductCapacity(product, products[productId], productPoolIds[productId], poolProducts, assets);
      });
    });

    it('should filter out null responses', function () {
      // Create a mock store where the product doesn't exist
      const nullProductStore = {
        getState: () => ({
          ...mockStore,
          products: {},
          productPoolIds: {},
          poolProducts: {},
          assets: mockStore.assets,
          assetRates: mockStore.assetRates,
        }),
      };

      const response = getAllProductCapacities(nullProductStore);
      expect(response).to.have.lengthOf(0);
    });
  });

  describe('getProductCapacity', function () {
    it('should return detailed capacity for a single product', function () {
      const productId = 3;
      const response = getProductCapacity(store, productId);

      const { productPoolIds, poolProducts } = store.getState();
      const poolIds = productPoolIds[productId];

      // Check basic product info
      expect(response.productId).to.equal(productId);

      // Check NXM capacity calculation
      let totalAvailableNXM = Zero;
      poolIds.forEach(poolId => {
        const poolProduct = poolProducts[`${productId}_${poolId}`];
        const lastTranche = poolProduct.trancheCapacities[poolProduct.trancheCapacities.length - 1];
        totalAvailableNXM = totalAvailableNXM.add(lastTranche);
      });

      // Check used capacity
      let totalUsedCapacity = Zero;
      poolIds.forEach(poolId => {
        const poolProduct = poolProducts[`${productId}_${poolId}`];
        poolProduct.allocations.forEach(allocation => {
          totalUsedCapacity = totalUsedCapacity.add(allocation.mul(NXM_PER_ALLOCATION_UNIT));
        });
      });

      expect(response.usedCapacity.toString()).to.equal(totalUsedCapacity.toString());
    });

    it('should include detailed pool breakdown when withPools is true', function () {
      const now = getCurrentTimestamp();
      const productId = '3';
      const response = getProductCapacity(store, productId, { withPools: true });
      const { productPoolIds, poolProducts, products } = store.getState();

      expect(response.capacityPerPool).to.have.lengthOf(productPoolIds[productId].length);

      response.capacityPerPool.forEach(poolCapacity =>
        verifyPoolCapacity(poolCapacity, productId, products, poolProducts, now),
      );
    });
  });

  describe('getPoolCapacity', function () {
    it('should return detailed pool capacity with correct utilization rate', function () {
      const poolId = 4;
      const response = getPoolCapacity(store, poolId);

      const { poolProducts, products } = store.getState();
      const now = getCurrentTimestamp();

      // Check products in pool
      const productsInPool = Object.entries(poolProducts)
        .filter(([key]) => key.endsWith(`_${poolId}`))
        .map(([key]) => Number(key.split('_')[0]));

      expect(response.productsCapacity).to.have.lengthOf(productsInPool.length);

      // Calculate expected utilization rate
      let totalAvailableNXM = Zero;
      let totalUsedNXM = Zero;

      response.productsCapacity.forEach(product => {
        const poolProduct = poolProducts[`${product.productId}_${poolId}`];
        const storeProduct = products[product.productId];

        // Calculate first usable tranche index
        const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(
          now,
          storeProduct.gracePeriod,
          SECONDS_PER_DAY.mul(30),
        );

        // Calculate available capacity
        const availableCapacity = calculateAvailableCapacity(
          poolProduct.trancheCapacities,
          poolProduct.allocations,
          firstUsableTrancheIndex,
        );

        const nxmCapacity = product.availableCapacity.find(c => c.assetId === 255);
        expect(nxmCapacity.amount.toString()).to.equal(availableCapacity.mul(NXM_PER_ALLOCATION_UNIT).toString());
        totalAvailableNXM = totalAvailableNXM.add(availableCapacity.mul(NXM_PER_ALLOCATION_UNIT));

        // Check used capacity
        let productUsedCapacity = Zero;
        poolProduct.allocations.forEach(allocation => {
          productUsedCapacity = productUsedCapacity.add(allocation);
        });
        expect(product.usedCapacity.toString()).to.equal(productUsedCapacity.mul(NXM_PER_ALLOCATION_UNIT).toString());
        totalUsedNXM = totalUsedNXM.add(productUsedCapacity.mul(NXM_PER_ALLOCATION_UNIT));
      });

      // Verify pool utilization rate
      const expectedUtilizationRate = totalUsedNXM.mul(10000).div(totalAvailableNXM.add(totalUsedNXM));
      expect(response.utilizationRate.toString()).to.equal(expectedUtilizationRate.toString());
    });
  });

  describe('getProductCapacityInPool', function () {
    it('should return detailed capacity for a specific product in a specific pool', function () {
      const poolId = 4;
      const productId = '3';
      const response = getProductCapacityInPool(store, poolId, productId);

      verifyCapacityResponse(response);

      const { poolProducts, products } = store.getState();
      const poolProduct = poolProducts[`${productId}_${poolId}`];

      // Verify used capacity
      const expectedUsedCapacity = calculateExpectedUsedCapacity(poolProduct);
      expect(response.usedCapacity.toString()).to.equal(expectedUsedCapacity.toString());

      // Verify price calculations
      verifyPriceCalculations(response, products[productId]);
    });
  });

  describe('getUtilizationRate', function () {
    it('should calculate utilization rate correctly', function () {
      const availableNXM = parseEther('100');
      const usedNXM = parseEther('50');
      // Expected: (50 / (100 + 50)) * 10000 = 3333 basis points
      const rate = getUtilizationRate(availableNXM, usedNXM);
      expect(rate.toNumber()).to.equal(3333);
    });

    it('should return 0 when no capacity is used', function () {
      const availableNXM = parseEther('100');
      const usedNXM = Zero;
      const rate = getUtilizationRate(availableNXM, usedNXM);
      expect(rate.toNumber()).to.equal(0);
    });

    it('should return 0 when total capacity is zero', function () {
      const availableNXM = Zero;
      const usedNXM = Zero;
      const rate = getUtilizationRate(availableNXM, usedNXM);
      expect(rate.toNumber()).to.equal(0);
    });

    it('should return undefined when inputs are missing', function () {
      expect(getUtilizationRate(null, parseEther('50'))).to.equal(undefined);
      expect(getUtilizationRate(parseEther('100'), null)).to.equal(undefined);
      expect(getUtilizationRate(null, null)).to.equal(undefined);
    });

    it('should handle very large numbers correctly', function () {
      const largeNumber = parseEther('1000000'); // 1M ETH
      const rate = getUtilizationRate(largeNumber, largeNumber);
      expect(rate.toNumber()).to.equal(5000); // Should be 50%
    });

    it('should handle very small numbers correctly', function () {
      const smallNumber = BigNumber.from(1);
      const rate = getUtilizationRate(smallNumber, smallNumber);
      expect(rate.toNumber()).to.equal(5000); // Should be 50%
    });
  });

  describe('getProductsInPool', function () {
    it('should return all products in a specific pool', function () {
      const poolId = 1;
      const { productPoolIds } = store.getState();
      const products = getProductsInPool(store, poolId);

      // Check against mock store data
      const expectedProducts = Object.keys(productPoolIds).filter(productId =>
        productPoolIds[productId].includes(poolId),
      );

      expect(products).to.have.members(expectedProducts);
      expect(products).to.have.lengthOf(expectedProducts.length);
    });

    it('should return empty array for pool with no products', function () {
      const nonExistentPoolId = 999;
      const products = getProductsInPool(store, nonExistentPoolId);
      expect(products).to.be.an('array');
      expect(products).to.have.lengthOf(0);
    });

    it('should handle string pool ids', function () {
      const poolId = '1';
      const { productPoolIds } = store.getState();
      const products = getProductsInPool(store, poolId);

      const expectedProducts = Object.keys(productPoolIds).filter(productId =>
        productPoolIds[productId].includes(Number(poolId)),
      );

      expect(products).to.have.members(expectedProducts);
    });

    it('should handle invalid pool id', function () {
      const products = getProductsInPool(store, -1);
      expect(products).to.be.an('array');
      expect(products).to.have.lengthOf(0);
    });

    it('should handle string vs number pool ids consistently', function () {
      const numericResult = getProductsInPool(store, 1);
      const stringResult = getProductsInPool(store, '1');
      expect(numericResult).to.deep.equal(stringResult);
    });
  });

  describe('calculateFirstUsableTrancheForMaxPeriodIndex', function () {
    it('should calculate correct tranche index for max period', function () {
      const now = BigNumber.from(1678700054); // From mock store
      const gracePeriod = BigNumber.from(30); // 30 seconds grace period

      const result = calculateFirstUsableTrancheForMaxPeriodIndex(now, gracePeriod);

      // Calculate expected result
      const firstActiveTrancheId = calculateTrancheId(now);
      const firstUsableTrancheForMaxPeriodId = calculateTrancheId(now.add(MAX_COVER_PERIOD).add(gracePeriod));
      const expected = firstUsableTrancheForMaxPeriodId - firstActiveTrancheId;

      expect(result).to.equal(expected);
    });

    it('should handle zero grace period', function () {
      const now = BigNumber.from(1678700054);
      const gracePeriod = Zero;

      const result = calculateFirstUsableTrancheForMaxPeriodIndex(now, gracePeriod);

      const firstActiveTrancheId = calculateTrancheId(now);
      const firstUsableTrancheForMaxPeriodId = calculateTrancheId(now.add(MAX_COVER_PERIOD).add(gracePeriod));
      const expected = firstUsableTrancheForMaxPeriodId - firstActiveTrancheId;

      expect(result).to.equal(expected);
    });

    it('should handle large grace period', function () {
      const now = BigNumber.from(1678700054);
      const gracePeriod = BigNumber.from(3024000); // Large grace period from mock store

      const result = calculateFirstUsableTrancheForMaxPeriodIndex(now, gracePeriod);

      const firstActiveTrancheId = calculateTrancheId(now);
      const firstUsableTrancheForMaxPeriodId = calculateTrancheId(now.add(MAX_COVER_PERIOD).add(gracePeriod));
      const expected = firstUsableTrancheForMaxPeriodId - firstActiveTrancheId;

      expect(result).to.equal(expected);
    });
  });

  describe('calculatePoolUtilizationRate', function () {
    let defaultProducts;

    before(function () {
      defaultProducts = [
        {
          availableCapacity: [
            { assetId: 255, amount: parseEther('100') }, // NXM capacity
            { assetId: 1, amount: parseEther('50') }, // Other asset capacity
          ],
          usedCapacity: parseEther('50'), // Used capacity
        },
        {
          availableCapacity: [
            { assetId: 255, amount: parseEther('200') }, // NXM capacity
            { assetId: 1, amount: parseEther('100') }, // Other asset capacity
          ],
          usedCapacity: parseEther('100'), // Used capacity
        },
      ];
    });

    it('should calculate utilization rate correctly for multiple products', function () {
      const products = [...defaultProducts];
      const utilizationRate = calculatePoolUtilizationRate(products);
      // Total available: 300 NXM
      // Total used: 150 NXM
      // Expected rate: (150 / (300 + 150)) * 10000 = 3333 basis points
      expect(utilizationRate.toNumber()).to.equal(3333);
    });

    it('should handle empty products array', function () {
      const products = [];
      const utilizationRate = calculatePoolUtilizationRate(products);
      expect(utilizationRate.toNumber()).to.equal(0);
    });

    it('should handle products with no NXM capacity', function () {
      const products = [
        {
          availableCapacity: [{ assetId: 1, amount: parseEther('50') }],
          usedCapacity: parseEther('25'),
        },
      ];
      const utilizationRate = calculatePoolUtilizationRate(products);
      expect(utilizationRate.toNumber()).to.equal(10000); // 100% utilization when no available NXM
    });

    it('should handle products with zero used capacity', function () {
      const products = defaultProducts.map(product => ({
        ...product,
        usedCapacity: Zero,
      }));
      const utilizationRate = calculatePoolUtilizationRate(products);
      expect(utilizationRate.toNumber()).to.equal(0);
    });

    it('should handle products with zero total capacity', function () {
      const products = defaultProducts.map(product => ({
        ...product,
        availableCapacity: [{ assetId: 255, amount: Zero }],
        usedCapacity: Zero,
      }));
      const utilizationRate = calculatePoolUtilizationRate(products);
      expect(utilizationRate.toNumber()).to.equal(0);
    });

    it('should handle products with missing NXM capacity', function () {
      const products = [
        {
          availableCapacity: [{ assetId: 1, amount: parseEther('50') }], // No NXM (255)
          usedCapacity: parseEther('25'),
        },
      ];
      const rate = calculatePoolUtilizationRate(products);
      expect(rate.toNumber()).to.equal(10000); // Should be 100% when no available NXM
    });

    it('should aggregate capacity across multiple products correctly', function () {
      const products = [...defaultProducts];
      const rate = calculatePoolUtilizationRate(products);
      // Total available: 300, Total used: 150
      // Expected: (150 / (300 + 150)) * 10000 = 3333
      expect(rate.toNumber()).to.equal(3333);
    });
  });

  describe('API Services', function () {
    it('should handle custom period seconds in getAllProductCapacities', function () {
      const response = getAllProductCapacities(store, {
        periodSeconds: SECONDS_PER_DAY.mul(7), // 1 week
      });
      expect(response).to.be.an('array');
      expect(response.length).to.be.greaterThan(0);
    });

    it('should handle invalid period seconds gracefully', function () {
      const response = getProductCapacity(store, '0', {
        periodSeconds: Zero,
      });
      expect(response).to.not.equal(null);
    });

    it('should return consistent data structure across all capacity endpoints', function () {
      const poolId = '1';
      const productId = '0';
      const { assets, assetRates, poolProducts: storePoolProducts, products, productPoolIds } = store.getState();
      const now = getCurrentTimestamp();

      // Get responses from all endpoints
      const singleProduct = getProductCapacity(store, productId);
      const poolCapacityResponse = getPoolCapacity(store, poolId);
      const poolProduct = getProductCapacityInPool(store, poolId, productId);

      // Helper to verify product capacity structure
      const verifyProductCapacity = (product, expectedPoolProduct, isSinglePool = false) => {
        // Verify product ID
        expect(product.productId).to.equal(Number(productId));

        // Calculate and verify available capacity for each asset
        product.availableCapacity.forEach(capacity => {
          const { assetId, amount, asset } = capacity;

          // Verify asset info
          expect(asset).to.deep.equal(assets[assetId]);

          // Calculate expected amount
          let expectedAmount;
          if (assetId === 255) {
            if (isSinglePool) {
              // For single pool responses, use direct capacity calculation
              const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(
                now,
                products[productId].gracePeriod,
                SECONDS_PER_DAY.mul(30),
              );
              expectedAmount = calculateAvailableCapacity(
                expectedPoolProduct.trancheCapacities,
                expectedPoolProduct.allocations,
                firstUsableTrancheIndex,
              ).mul(NXM_PER_ALLOCATION_UNIT);
            } else {
              // For multi-pool responses, sum capacities across all pools
              expectedAmount = productPoolIds[productId].reduce((total, pid) => {
                const poolProduct = storePoolProducts[`${productId}_${pid}`];
                const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(
                  now,
                  products[productId].gracePeriod,
                  SECONDS_PER_DAY.mul(30),
                );
                const poolCapacity = calculateAvailableCapacity(
                  poolProduct.trancheCapacities,
                  poolProduct.allocations,
                  firstUsableTrancheIndex,
                ).mul(NXM_PER_ALLOCATION_UNIT);
                return total.add(poolCapacity);
              }, Zero);
            }
          } else {
            // For other assets, convert from NXM using asset rate
            const nxmCapacity = product.availableCapacity.find(c => c.assetId === 255).amount;
            expectedAmount = nxmCapacity.mul(assetRates[assetId]).div(WeiPerEther);
          }
          expect(amount.toString()).to.equal(expectedAmount.toString());
        });

        // Calculate and verify used capacity
        let expectedUsedCapacity;
        if (isSinglePool) {
          expectedUsedCapacity = expectedPoolProduct.allocations
            .reduce((sum, alloc) => sum.add(alloc), Zero)
            .mul(NXM_PER_ALLOCATION_UNIT);
        } else {
          expectedUsedCapacity = productPoolIds[productId].reduce((total, pid) => {
            const poolProduct = storePoolProducts[`${productId}_${pid}`];
            const poolUsed = poolProduct.allocations
              .reduce((sum, alloc) => sum.add(alloc), Zero)
              .mul(NXM_PER_ALLOCATION_UNIT);
            return total.add(poolUsed);
          }, Zero);
        }
        expect(product.usedCapacity.toString()).to.equal(expectedUsedCapacity.toString());

        // Verify price calculations based on product type
        if (products[productId].useFixedPrice) {
          expect(product.minAnnualPrice.toString()).to.equal(product.maxAnnualPrice.toString());
          if (isSinglePool) {
            expect(product.minAnnualPrice.toString()).to.equal(expectedPoolProduct.targetPrice.toString());
          }
        } else {
          expect(product.minAnnualPrice.toString()).to.not.equal(product.maxAnnualPrice.toString());
          expect(BigNumber.from(product.minAnnualPrice).gt(Zero)).to.equal(true);
          expect(BigNumber.from(product.maxAnnualPrice).gt(Zero)).to.equal(true);
        }
      };

      // Verify single product response (multi-pool)
      verifyProductCapacity(singleProduct, storePoolProducts[`${productId}_${poolId}`], false);

      // Verify pool product response (single-pool)
      verifyProductCapacity(poolProduct, storePoolProducts[`${productId}_${poolId}`], true);

      // Verify product in pool products response (single-pool)
      const productInPool = poolCapacityResponse.productsCapacity.find(p => p.productId === Number(productId));
      verifyProductCapacity(productInPool, storePoolProducts[`${productId}_${poolId}`], true);

      // Verify pool-level data
      expect(poolCapacityResponse.poolId).to.equal(Number(poolId));

      // Calculate and verify pool utilization rate
      const totalAvailableNXM = poolCapacityResponse.productsCapacity.reduce((sum, product) => {
        const nxmCapacity = product.availableCapacity.find(c => c.assetId === 255).amount;
        return sum.add(nxmCapacity);
      }, Zero);

      const totalUsedNXM = poolCapacityResponse.productsCapacity.reduce(
        (sum, product) => sum.add(product.usedCapacity),
        Zero,
      );

      const expectedUtilizationRate = totalUsedNXM.mul(10000).div(totalAvailableNXM.add(totalUsedNXM));
      expect(poolCapacityResponse.utilizationRate.toString()).to.equal(expectedUtilizationRate.toString());
    });
  });
});
