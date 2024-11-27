const { expect } = require('chai');
const ethers = require('ethers');
const sinon = require('sinon');

const { poolProductCapacities } = require('./responses');
const {
  getCurrentTimestamp,
  verifyPriceCalculations,
  verifyCapacityResponse,
  calculateExpectedUsedCapacity,
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
  calculateTrancheId,
  calculateFirstUsableTrancheIndex,
  calculateAvailableCapacity,
} = require('../../src/lib/helpers');
const mockStore = require('../mocks/store');

const { BigNumber } = ethers;
const { parseEther } = ethers.utils;
const { Zero, WeiPerEther } = ethers.constants;

describe('Capacity Engine tests', function () {
  const store = { getState: () => null };

  beforeEach(function () {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('calculateProductCapacity', function () {
    it('should calculate product capacity correctly', function () {
      const productId = '0';
      const now = getCurrentTimestamp();
      const { assets, assetRates, poolProducts } = store.getState();

      const response = calculateProductCapacity(store, productId, {
        periodSeconds: SECONDS_PER_DAY.mul(30),
        now,
        assets,
        assetRates,
      });

      expect(response.productId).to.equal(0);
      expect(response.availableCapacity).to.be.an('array');

      // Get capacities from both pools
      const pool1Capacity = calculateAvailableCapacity(
        poolProducts['0_1'].trancheCapacities,
        poolProducts['0_1'].allocations,
        0,
      );
      const pool2Capacity = calculateAvailableCapacity(
        poolProducts['0_2'].trancheCapacities,
        poolProducts['0_2'].allocations,
        0,
      );

      // Verify total NXM capacity across both pools
      const totalCapacity = pool1Capacity.add(pool2Capacity).mul(NXM_PER_ALLOCATION_UNIT);
      const nxmCapacity = response.availableCapacity.find(c => c.assetId === 255);
      expect(nxmCapacity.amount.toString()).to.equal(totalCapacity.toString());
    });

    it('should handle fixed price products correctly', function () {
      const fixedPriceProductId = '2';
      const now = BigNumber.from(Date.now()).div(1000);
      const response = calculateProductCapacity(store, fixedPriceProductId, {
        periodSeconds: SECONDS_PER_DAY.mul(30),
        now,
        assets: mockStore.assets,
        assetRates: mockStore.assetRates,
      });

      expect(response.minAnnualPrice.toString()).to.deep.equal(response.maxAnnualPrice.toString());
    });

    it('should handle non-fixed price products correctly', function () {
      const nonFixedPriceProductId = '0';
      const now = BigNumber.from(Date.now()).div(1000);
      const response = calculateProductCapacity(store, nonFixedPriceProductId, {
        periodSeconds: SECONDS_PER_DAY.mul(30),
        now,
        assets: mockStore.assets,
        assetRates: mockStore.assetRates,
      });

      expect(response.minAnnualPrice.toString()).to.not.deep.equal(response.maxAnnualPrice.toString());
    });

    it('should include capacityPerPool when withPools is true', function () {
      const productId = '0';
      const now = BigNumber.from(Date.now()).div(1000);
      const response = calculateProductCapacity(store, productId, {
        periodSeconds: SECONDS_PER_DAY.mul(30),
        withPools: true,
        now,
        assets: mockStore.assets,
        assetRates: mockStore.assetRates,
      });

      const { poolProducts, assets, assetRates } = store.getState();

      response.capacityPerPool.forEach(poolCapacity => {
        const poolProduct = poolProducts[`${productId}_${poolCapacity.poolId}`];

        poolCapacity.availableCapacity.forEach(capacity => {
          expect(capacity.asset).to.deep.equal(assets[capacity.assetId]);

          if (capacity.assetId !== 255) {
            const nxmCapacity = poolCapacity.availableCapacity.find(c => c.assetId === 255).amount;
            const expectedAmount = nxmCapacity.mul(assetRates[capacity.assetId]).div(WeiPerEther);
            expect(capacity.amount.toString()).to.equal(expectedAmount.toString());
          }
        });

        const expectedAllocatedNxm = poolProduct.allocations
          .reduce((sum, alloc) => sum.add(alloc), Zero)
          .mul(NXM_PER_ALLOCATION_UNIT);
        expect(poolCapacity.allocatedNxm.toString()).to.equal(expectedAllocatedNxm.toString());
      });
    });

    it('should filter by poolId when provided', function () {
      const productId = '0';
      const poolId = 2;
      const now = BigNumber.from(Date.now()).div(1000);
      const response = calculateProductCapacity(store, productId, {
        poolId,
        periodSeconds: SECONDS_PER_DAY.mul(30),
        now,
        assets: mockStore.assets,
        assetRates: mockStore.assetRates,
      });

      const expectedCapacity = poolProductCapacities[poolId].productsCapacity.find(
        p => p.productId === Number(productId),
      );
      const expectedAvailableCapacity = expectedCapacity.availableCapacity.map(cap => ({
        ...cap,
        amount: BigNumber.from(cap.amount),
      }));

      expect(response.availableCapacity).to.deep.equal(expectedAvailableCapacity);
    });

    it('should return null for non-existing product', function () {
      const nonExistingProductId = '999';
      const now = BigNumber.from(Date.now()).div(1000);
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
      const now = BigNumber.from(Date.now()).div(1000);
      // Mock store to return zero capacity with all required fields
      const zeroCapacityStore = {
        getState: () => ({
          ...mockStore,
          poolProducts: {
            '0_1': {
              productId: 0,
              poolId: 1,
              trancheCapacities: [Zero, Zero, Zero, Zero, Zero, Zero, Zero, Zero], // 8 tranches of zero capacity
              allocations: [Zero, Zero, Zero, Zero, Zero, Zero, Zero, Zero], // 8 tranches of zero allocations
              lastEffectiveWeight: Zero,
              targetWeight: Zero,
              targetPrice: Zero,
              bumpedPrice: Zero,
              bumpedPriceUpdateTime: Zero,
            },
          },
          // Keep the product pool IDs mapping
          productPoolIds: {
            0: [1], // Only pool 1 for product 0
          },
        }),
      };

      const response = calculateProductCapacity(zeroCapacityStore, productId, {
        periodSeconds: SECONDS_PER_DAY.mul(30),
        now,
        assets: mockStore.assets,
        assetRates: mockStore.assetRates,
      });

      expect(response.availableCapacity[0].amount.toString()).to.equal(Zero.toString());
      expect(response.maxAnnualPrice.toString()).to.equal(Zero.toString());
    });

    it('should calculate capacity across multiple tranches for non-fixed price products', function () {
      const productId = '1'; // Non-fixed price product
      const now = BigNumber.from(Date.now()).div(1000);
      const response = calculateProductCapacity(store, productId, {
        periodSeconds: SECONDS_PER_DAY.mul(30),
        now,
        assets: mockStore.assets,
        assetRates: mockStore.assetRates,
      });

      // Should have different min and max prices
      expect(response.minAnnualPrice).to.not.deep.equal(response.maxAnnualPrice);
      expect(response.maxAnnualPrice).to.not.deep.equal(Zero);
    });
  });

  describe('getAllProductCapacities', function () {
    it('should return capacity for all products across all pools', function () {
      const response = getAllProductCapacities(store);
      const { products, productPoolIds, poolProducts, assets } = store.getState();

      // Should return all products from store
      expect(response).to.have.lengthOf(Object.keys(products).length);

      // Check each product's capacity data
      response.forEach(product => {
        const productId = product.productId;
        const storeProduct = products[productId];
        const poolIds = productPoolIds[productId];

        // Check product exists in store
        expect(storeProduct).to.not.equal(undefined);

        // Verify available capacity calculation for each pool
        const now = BigNumber.from(Date.now()).div(1000);
        const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(
          now,
          storeProduct.gracePeriod,
          SECONDS_PER_DAY.mul(30),
        );

        // Calculate expected NXM using the same logic as the function
        const expectedAvailableNXM = poolIds.reduce((total, poolId) => {
          const poolProduct = poolProducts[`${productId}_${poolId}`];
          const availableCapacity = calculateAvailableCapacity(
            poolProduct.trancheCapacities,
            poolProduct.allocations,
            firstUsableTrancheIndex,
          );
          const availableInNXM = availableCapacity.mul(NXM_PER_ALLOCATION_UNIT);
          return total.add(availableInNXM);
        }, Zero);

        // Check NXM capacity
        const nxmCapacity = product.availableCapacity.find(c => c.assetId === 255);
        expect(nxmCapacity.amount.toString()).to.equal(expectedAvailableNXM.toString());
        expect(nxmCapacity.asset).to.deep.equal(assets[255]);

        // Check used capacity
        const expectedUsedCapacity = poolIds.reduce((total, poolId) => {
          const poolProduct = poolProducts[`${productId}_${poolId}`];
          const usedCapacity = poolProduct.allocations.reduce((sum, alloc) => sum.add(alloc), Zero);
          const usedCapacityInNXM = usedCapacity.mul(NXM_PER_ALLOCATION_UNIT);
          return total.add(usedCapacityInNXM);
        }, Zero);

        expect(product.usedCapacity.toString()).to.equal(expectedUsedCapacity.toString());

        // Check price calculations based on product type
        if (storeProduct.useFixedPrice) {
          expect(product.minAnnualPrice.toString()).to.equal(product.maxAnnualPrice.toString());
        } else {
          expect(product.minAnnualPrice.toString()).to.not.equal(product.maxAnnualPrice.toString());
        }
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
      const productId = '3';
      const response = getProductCapacity(store, productId, { withPools: true });
      const { productPoolIds, poolProducts, products } = store.getState();
      const now = BigNumber.from(Date.now()).div(1000);

      expect(response.capacityPerPool).to.have.lengthOf(productPoolIds[productId].length);

      response.capacityPerPool.forEach(poolCapacity => {
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
        const nxmCapacity = poolCapacity.availableCapacity.find(c => c.assetId === 255);
        expect(nxmCapacity.amount.toString()).to.equal(availableCapacity.mul(NXM_PER_ALLOCATION_UNIT).toString());

        // Check pool-specific used capacity
        let poolUsedCapacity = Zero;
        poolProduct.allocations.forEach(allocation => {
          poolUsedCapacity = poolUsedCapacity.add(allocation);
        });
        expect(poolCapacity.allocatedNxm.toString()).to.equal(poolUsedCapacity.mul(NXM_PER_ALLOCATION_UNIT).toString());
      });
    });
  });

  describe('getPoolCapacity', function () {
    it('should return detailed pool capacity with correct utilization rate', function () {
      const poolId = 4;
      const response = getPoolCapacity(store, poolId);

      const { poolProducts, products } = store.getState();
      const now = BigNumber.from(Date.now()).div(1000);

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
    it('should calculate utilization rate correctly for multiple products', function () {
      const products = [
        {
          availableCapacity: [
            { assetId: 255, amount: parseEther('100') },
            { assetId: 1, amount: parseEther('50') },
          ],
          usedCapacity: parseEther('50'),
        },
        {
          availableCapacity: [
            { assetId: 255, amount: parseEther('200') },
            { assetId: 1, amount: parseEther('100') },
          ],
          usedCapacity: parseEther('100'),
        },
      ];

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
      const products = [
        {
          availableCapacity: [{ assetId: 255, amount: parseEther('100') }],
          usedCapacity: Zero,
        },
      ];

      const utilizationRate = calculatePoolUtilizationRate(products);
      expect(utilizationRate.toNumber()).to.equal(0);
    });

    it('should handle products with zero total capacity', function () {
      const products = [
        {
          availableCapacity: [{ assetId: 255, amount: Zero }],
          usedCapacity: Zero,
        },
      ];

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
      const products = [
        {
          availableCapacity: [{ assetId: 255, amount: parseEther('100') }],
          usedCapacity: parseEther('50'),
        },
        {
          availableCapacity: [{ assetId: 255, amount: parseEther('200') }],
          usedCapacity: parseEther('100'),
        },
      ];
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
      const now = BigNumber.from(Date.now()).div(1000);

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
