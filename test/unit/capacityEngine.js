const { expect } = require('chai');
const ethers = require('ethers');
const sinon = require('sinon');

const { poolProductCapacities } = require('./responses');
const { calculateExpectedUsedCapacity, getCurrentTimestamp, verifyCapacityResponse } = require('./utils');
const {
  getAllProductCapacities,
  getProductCapacity,
  getPoolCapacity,
  getProductCapacityInPool,
  calculateFirstUsableTrancheIndexForMaxPeriod,
  calculatePoolUtilizationRate,
  calculateProductCapacity,
} = require('../../src/lib/capacityEngine');
const { MAX_COVER_PERIOD, SECONDS_PER_DAY, NXM_PER_ALLOCATION_UNIT } = require('../../src/lib/constants');
const {
  calculateAvailableCapacity,
  calculateBasePrice,
  calculateFirstUsableTrancheIndex,
  calculatePremiumPerYear,
  calculateProductDataForTranche,
  calculateTrancheId,
} = require('../../src/lib/helpers');
const mockStore = require('../mocks/store');

const { BigNumber } = ethers;
const { parseEther } = ethers.utils;
const { Zero, WeiPerEther } = ethers.constants;

const verifyPoolCapacity = (poolCapacity, productId, products, poolProducts, now, assets, assetRates) => {
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

  // Check pool-specific NXM capacity
  const nxmCapacityAmount = poolCapacity.availableCapacity.find(c => c.assetId === 255)?.amount || Zero;
  expect(nxmCapacityAmount.toString()).to.equal(availableCapacity.mul(NXM_PER_ALLOCATION_UNIT).toString());

  // Check pool-specific used capacity
  const expectedAllocatedNxm = poolProduct.allocations
    .reduce((sum, alloc) => sum.add(alloc), Zero)
    .mul(NXM_PER_ALLOCATION_UNIT);
  expect(poolCapacity.allocatedNxm.toString()).to.equal(expectedAllocatedNxm.toString());

  // Verify other asset conversions
  poolCapacity.availableCapacity
    .filter(capacity => capacity.assetId !== 255)
    .forEach(capacity => {
      expect(capacity.asset).to.deep.equal(assets[capacity.assetId]);
      const expectedAmount = nxmCapacityAmount.mul(assetRates[capacity.assetId]).div(WeiPerEther);
      expect(capacity.amount.toString()).to.equal(expectedAmount.toString());
    });
};

describe('capacityEngine', function () {
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
        period: SECONDS_PER_DAY.mul(30),
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
      const expectedFixedPrice = WeiPerEther.mul(calculatePremiumPerYear(NXM_PER_ALLOCATION_UNIT, targetPrice)).div(
        NXM_PER_ALLOCATION_UNIT,
      );

      expect(aggregatedData.capacityUsedNXM.toString()).to.equal(used.toString());
      expect(aggregatedData.capacityAvailableNXM.toString()).to.equal(availableInNXM.toString());
      expect(aggregatedData.minPrice.toString()).to.equal(expectedFixedPrice.toString());
      expect(aggregatedData.totalPremium.toString()).to.equal(
        calculatePremiumPerYear(availableInNXM, targetPrice).toString(),
      );

      expect(capacityPerPool).to.have.lengthOf(1);
      expect(capacityPool.poolId).to.equal(1);
      expect(capacityPool.minAnnualPrice.toString()).to.equal(expectedFixedPrice.toString());
      expect(capacityPool.maxAnnualPrice.toString()).to.equal(expectedFixedPrice.toString());
      expect(capacityPool.allocatedNxm.toString()).to.equal(used.toString());
    });

    it('should handle non-fixed price products correctly', function () {
      const { poolProducts, products } = store.getState();
      const productId = '0';
      const productPool = [mockStore.poolProducts['0_1']];
      const [{ allocations, trancheCapacities, targetPrice, bumpedPrice, bumpedPriceUpdateTime }] = productPool;
      const lastIndex = allocations.length - 1;

      const response = calculateProductCapacity(store, productId, {
        period: SECONDS_PER_DAY.mul(30),
        now,
        assets,
        assetRates,
      });

      // Calculate expected values
      const availableCapacity = trancheCapacities[lastIndex].sub(allocations[lastIndex]);
      const availableInNXM = availableCapacity.mul(NXM_PER_ALLOCATION_UNIT);

      // Calculate base price
      const basePrice = calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

      // Calculate expected min annual price
      const minPremiumPerYear = calculatePremiumPerYear(NXM_PER_ALLOCATION_UNIT, basePrice);
      const expectedMinPrice = WeiPerEther.mul(minPremiumPerYear).div(NXM_PER_ALLOCATION_UNIT);

      // Calculate expected max annual price
      const maxPremiumPerYear = calculatePremiumPerYear(availableInNXM, basePrice);
      const expectedMaxPrice = availableInNXM.isZero() ? Zero : WeiPerEther.mul(maxPremiumPerYear).div(availableInNXM);

      expect(response.minAnnualPrice.toString()).to.equal(expectedMinPrice.toString());
      expect(response.maxAnnualPrice.toString()).to.equal(expectedMaxPrice.toString());

      expect(response.minAnnualPrice.toString()).to.be.equal(response.maxAnnualPrice.toString());

      response.capacityPerPool.forEach(poolCapacity =>
        verifyPoolCapacity(poolCapacity, productId, products, poolProducts, now, assets, assetRates),
      );
    });

    it('should not include capacityPerPool when withPools is false', function () {
      const now = getCurrentTimestamp();
      const productId = '0';
      const response = calculateProductCapacity(store, productId, {
        period: SECONDS_PER_DAY.mul(30),
        now,
        assets,
        assetRates,
        withPools: false,
      });

      expect(response.capacityPerPool).to.be.equal(undefined);
    });

    it('should filter by poolId when provided', function () {
      const productId = '0';
      const poolId = 2;
      const now = getCurrentTimestamp();
      const response = calculateProductCapacity(store, productId, {
        poolId,
        period: SECONDS_PER_DAY.mul(30),
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
        period: SECONDS_PER_DAY.mul(30),
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
        period: SECONDS_PER_DAY.mul(30),
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
        period: SECONDS_PER_DAY.mul(7), // 1 week
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
      const minPremium1 = calculatePremiumPerYear(NXM_PER_ALLOCATION_UNIT, basePrice1);
      const minPremium2 = calculatePremiumPerYear(NXM_PER_ALLOCATION_UNIT, basePrice2);

      // Expected min price is the minimum of the two pools
      const expectedMinPrice = WeiPerEther.mul(minPremium1.lt(minPremium2) ? minPremium1 : minPremium2).div(
        NXM_PER_ALLOCATION_UNIT,
      );

      // Calculate max premium (for all available capacity)
      const availableCapacity1 = totalCapacity1.sub(usedCapacity1);
      const availableCapacity2 = totalCapacity2.sub(usedCapacity2);
      const maxPremium1 = calculatePremiumPerYear(availableCapacity1, basePrice1);
      const maxPremium2 = calculatePremiumPerYear(availableCapacity2, basePrice2);

      // Expected max price is the maximum premium per unit
      const maxPrice1 = availableCapacity1.isZero() ? Zero : WeiPerEther.mul(maxPremium1).div(availableCapacity1);
      const maxPrice2 = availableCapacity2.isZero() ? Zero : WeiPerEther.mul(maxPremium2).div(availableCapacity2);
      const expectedMaxPrice = maxPrice1.gt(maxPrice2) ? maxPrice1 : maxPrice2;

      // Verify prices
      expect(response.minAnnualPrice.toString()).to.equal(expectedMinPrice.toString());
      expect(response.maxAnnualPrice.toString()).to.equal(expectedMaxPrice.toString());

      expect(response.minAnnualPrice).to.deep.equal(response.maxAnnualPrice);

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
      const period = SECONDS_PER_DAY.mul(30);
      const response = getAllProductCapacities(store, period);
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
    it('should handle invalid period seconds gracefully getProductCapacity', function () {
      const invalidPeriod = Zero;
      const response = getProductCapacity(store, '0', invalidPeriod);
      expect(response).to.not.equal(null);
    });

    it('should return detailed capacity for a single product', function () {
      const productId = 3;
      const now = getCurrentTimestamp();
      const period = SECONDS_PER_DAY.mul(30);
      const response = getProductCapacity(store, productId, period);

      const { assets, assetRates, productPoolIds, poolProducts, products } = store.getState();
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

      expect(response.capacityPerPool).to.have.lengthOf(productPoolIds[productId].length);

      response.capacityPerPool.forEach(poolCapacity =>
        verifyPoolCapacity(poolCapacity, productId, products, poolProducts, now, assets, assetRates),
      );
    });
  });

  describe('getPoolCapacity', function () {
    it('should return detailed pool capacity with correct utilization rate', function () {
      const poolId = 4;
      const period = SECONDS_PER_DAY.mul(30);
      const response = getPoolCapacity(store, poolId, period);

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
      const period = SECONDS_PER_DAY.mul(30);
      const response = getProductCapacityInPool(store, poolId, productId, period);

      verifyCapacityResponse(response);

      const { poolProducts, products } = store.getState();
      const poolProduct = poolProducts[`${productId}_${poolId}`];

      // Verify used capacity
      const expectedUsedCapacity = calculateExpectedUsedCapacity(poolProduct);
      expect(response.usedCapacity.toString()).to.equal(expectedUsedCapacity.toString());

      // Verify price calculations
      expect(response.minAnnualPrice).to.be.instanceOf(BigNumber);
      expect(response.maxAnnualPrice).to.be.instanceOf(BigNumber);
      expect(response.minAnnualPrice.gt(Zero)).to.equal(true);
      expect(response.maxAnnualPrice.gt(Zero)).to.equal(true);

      expect(response.minAnnualPrice.toString()).to.equal(response.maxAnnualPrice.toString());
    });
  });

  describe('calculateFirstUsableTrancheIndexForMaxPeriod', function () {
    it('should calculate correct tranche index for max period', function () {
      const now = getCurrentTimestamp();
      const gracePeriod = SECONDS_PER_DAY.mul(35);

      const result = calculateFirstUsableTrancheIndexForMaxPeriod(now, gracePeriod);

      // Calculate expected result
      const firstActiveTrancheId = calculateTrancheId(now);
      const firstUsableTrancheIdForMaxPeriod = calculateTrancheId(now.add(MAX_COVER_PERIOD).add(gracePeriod));
      const expected = firstUsableTrancheIdForMaxPeriod - firstActiveTrancheId;

      expect(result).to.equal(expected);
    });

    it('should handle zero grace period', function () {
      const now = BigNumber.from(1678700054);
      const gracePeriod = Zero;

      const result = calculateFirstUsableTrancheIndexForMaxPeriod(now, gracePeriod);

      const firstActiveTrancheId = calculateTrancheId(now);
      const firstUsableTrancheIdForMaxPeriod = calculateTrancheId(now.add(MAX_COVER_PERIOD).add(gracePeriod));
      const expected = firstUsableTrancheIdForMaxPeriod - firstActiveTrancheId;

      expect(result).to.equal(expected);
    });

    it('should handle large grace period', function () {
      const now = getCurrentTimestamp();
      const gracePeriod = SECONDS_PER_DAY.mul(365);

      const result = calculateFirstUsableTrancheIndexForMaxPeriod(now, gracePeriod);

      const firstActiveTrancheId = calculateTrancheId(now);
      const firstUsableTrancheIdForMaxPeriod = calculateTrancheId(now.add(MAX_COVER_PERIOD).add(gracePeriod));
      const expected = firstUsableTrancheIdForMaxPeriod - firstActiveTrancheId;

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
    it('should return consistent data structure across all capacity endpoints', function () {
      const poolId = '1';
      const productId = '0';
      const { assets, assetRates, poolProducts: storePoolProducts, products, productPoolIds } = store.getState();
      const now = getCurrentTimestamp();
      const period = SECONDS_PER_DAY.mul(30);

      // Get responses from all endpoints
      const allProducts = getAllProductCapacities(store, period);
      const singleProduct = getProductCapacity(store, productId, period);
      const poolCapacityResponse = getPoolCapacity(store, poolId, period);
      const poolProduct = getProductCapacityInPool(store, poolId, productId, period);

      // Helper to verify product capacity structure
      const verifyProductCapacity = (
        product,
        expectedPoolProduct,
        isSinglePool = false,
        expectedProductId = productId,
      ) => {
        // Verify product ID
        expect(product.productId).to.equal(Number(expectedProductId));

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
                products[expectedProductId].gracePeriod,
                SECONDS_PER_DAY.mul(30),
              );
              expectedAmount = calculateAvailableCapacity(
                expectedPoolProduct.trancheCapacities,
                expectedPoolProduct.allocations,
                firstUsableTrancheIndex,
              ).mul(NXM_PER_ALLOCATION_UNIT);
            } else {
              // For multi-pool responses, sum capacities across all pools
              expectedAmount = productPoolIds[expectedProductId].reduce((total, pid) => {
                const poolProduct = storePoolProducts[`${expectedProductId}_${pid}`];
                const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(
                  now,
                  products[expectedProductId].gracePeriod,
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
          expectedUsedCapacity = productPoolIds[expectedProductId].reduce((total, pid) => {
            const poolProduct = storePoolProducts[`${expectedProductId}_${pid}`];
            const poolUsed = poolProduct.allocations
              .reduce((sum, alloc) => sum.add(alloc), Zero)
              .mul(NXM_PER_ALLOCATION_UNIT);
            return total.add(poolUsed);
          }, Zero);
        }
        expect(product.usedCapacity.toString()).to.equal(expectedUsedCapacity.toString());

        // Verify price calculations based on product type
        if (products[expectedProductId].useFixedPrice) {
          expect(product.minAnnualPrice.toString()).to.equal(product.maxAnnualPrice.toString());
          if (isSinglePool) {
            expect(product.minAnnualPrice.toString()).to.equal(expectedPoolProduct.targetPrice.toString());
          }
        } else {
          expect(product.minAnnualPrice.toString()).to.be.equal(product.maxAnnualPrice.toString());
          expect(BigNumber.from(product.minAnnualPrice).gt(Zero)).to.equal(true);
          expect(BigNumber.from(product.maxAnnualPrice).gt(Zero)).to.equal(true);
        }
      };

      // Verify all products response
      const productFromAll = allProducts.find(p => p.productId === Number(productId));
      expect(productFromAll).to.not.equal(undefined);
      verifyProductCapacity(productFromAll, storePoolProducts[`${productId}_${poolId}`], false);

      // Verify that all products are included
      const expectedProductIds = Object.keys(products).map(Number);
      const actualProductIds = allProducts.map(p => p.productId);
      expect(actualProductIds.sort()).to.deep.equal(expectedProductIds.sort());

      // Verify each product in allProducts has consistent structure
      allProducts.forEach(product => {
        const currentProductId = product.productId.toString();
        const productPoolProduct = storePoolProducts[`${currentProductId}_${poolId}`];
        if (productPoolProduct) {
          verifyProductCapacity(product, productPoolProduct, false, currentProductId);
        }
      });

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
