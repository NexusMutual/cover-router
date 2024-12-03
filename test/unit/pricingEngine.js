const { expect } = require('chai');
const ethers = require('ethers');

const { pricingEngine } = require('../../src/lib/pricingEngine');
const mockStore = require('../mocks/store');

const { BigNumber } = ethers;
const { parseEther } = ethers.utils;

describe('pricingEngine', () => {
  // Default store setup
  const createDefaultStore = () => ({
    getState: () => ({
      assets: mockStore.assets,
      assetRates: mockStore.assetRates,
      products: {
        1: {
          productType: 0,
          capacityReductionRatio: 0,
          useFixedPrice: false,
          gracePeriod: 30,
          id: 1,
        },
      },
      poolProducts: {
        '1_1': {
          productId: 1,
          poolId: 1,
          allocations: Array(8).fill(BigNumber.from(0)),
          trancheCapacities: [
            ...Array(7).fill(BigNumber.from(0)),
            BigNumber.from('1000000000000000000'), // 1 NXM
          ],
          lastEffectiveWeight: BigNumber.from(0),
          targetWeight: BigNumber.from(50),
          targetPrice: BigNumber.from(200),
          bumpedPrice: BigNumber.from(200),
          bumpedPriceUpdateTime: BigNumber.from(1678700054),
        },
        '1_2': {
          productId: 1,
          poolId: 2,
          allocations: Array(8).fill(BigNumber.from(0)),
          trancheCapacities: [
            ...Array(7).fill(BigNumber.from(0)),
            BigNumber.from('2000000000000000000'), // 2 NXM
          ],
          lastEffectiveWeight: BigNumber.from(0),
          targetWeight: BigNumber.from(50),
          targetPrice: BigNumber.from(300),
          bumpedPrice: BigNumber.from(300),
          bumpedPriceUpdateTime: BigNumber.from(1678700054),
        },
      },
      productPoolIds: {
        1: [1, 2],
      },
    }),
  });

  // Helper function to modify the default store
  const modifyStore = modifications => {
    const defaultStore = createDefaultStore();
    const state = defaultStore.getState();
    const newState = {
      ...state,
      ...modifications,
      poolProducts: {
        ...state.poolProducts,
        ...(modifications.poolProducts || {}),
      },
      productPoolIds: {
        ...state.productPoolIds,
        ...(modifications.productPoolIds || {}),
      },
    };
    return { getState: () => newState };
  };

  // Keep the existing createMockStore for backward compatibility
  const createMockStore = (poolProducts, product = null) => ({
    getState: () => ({
      assets: mockStore.assets,
      assetRates: mockStore.assetRates,
      products: {
        ...mockStore.products,
        ...(product && { [product.id]: product }),
      },
      poolProducts,
      productPoolIds: {
        1: Object.keys(poolProducts)
          .filter(key => key.startsWith('1_'))
          .map(key => Number(key.split('_')[1])),
      },
    }),
  });

  describe('input validation', () => {
    it('should return null if productPools is empty', () => {
      const store = createMockStore({});
      expect(pricingEngine(store, 1)).to.equal(null);
    });

    it('should return null if no pools found for the product', () => {
      const store = createMockStore({ '2_1': mockStore.poolProducts['2_1'] });
      expect(pricingEngine(store, 1)).to.equal(null);
    });
  });

  describe('pricing calculations', () => {
    it('should calculate correct pricing for a single pool', () => {
      const { poolProducts } = createDefaultStore().getState();
      const store = modifyStore({
        poolProducts: {
          '1_1': poolProducts['1_1'],
        },
        productPoolIds: { 1: [1] },
      });

      const result = pricingEngine(store, 1);
      expect(result).to.deep.equal({
        productId: 1,
        pricePerPool: [
          {
            poolId: 1,
            targetPrice: BigNumber.from(200),
          },
        ],
        weightedAveragePrice: BigNumber.from(200),
      });
    });

    it('should calculate weighted average price correctly for multiple pools', () => {
      const store = createMockStore({
        '1_1': {
          ...mockStore.poolProducts['1_1'],
          targetPrice: BigNumber.from(100),
          allocations: Array(8).fill(BigNumber.from(0)),
          trancheCapacities: [
            ...Array(7).fill(BigNumber.from(0)),
            BigNumber.from(75), // 60 available + 15 allocated
          ],
        },
        '1_2': {
          ...mockStore.poolProducts['1_2'],
          targetPrice: BigNumber.from(200),
          allocations: Array(8).fill(BigNumber.from(0)),
          trancheCapacities: [
            ...Array(7).fill(BigNumber.from(0)),
            BigNumber.from(25), // 20 available + 5 allocated
          ],
        },
      });

      const result = pricingEngine(store, 1);
      // Weighted average: ((100 * 60) + (200 * 20)) / (60 + 20) = 125
      expect(result.weightedAveragePrice.toString()).to.equal('125');
      expect(result.pricePerPool).to.have.length(2);
    });

    it('should handle pools with zero capacity', () => {
      const { poolProducts } = createDefaultStore().getState();
      const store = modifyStore({
        poolProducts: {
          '1_1': {
            ...poolProducts['1_1'],
            trancheCapacities: Array(8).fill(BigNumber.from(0)),
          },
          '1_2': poolProducts['1_2'],
        },
      });

      const result = pricingEngine(store, 1);
      expect(result.weightedAveragePrice.toString()).to.equal('300');
    });

    it('should handle all pools having zero capacity', () => {
      const { poolProducts } = createDefaultStore().getState();
      const store = modifyStore({
        poolProducts: {
          '1_1': {
            ...poolProducts['1_1'],
            trancheCapacities: Array(8).fill(BigNumber.from(0)),
          },
          '1_2': {
            ...poolProducts['1_2'],
            trancheCapacities: Array(8).fill(BigNumber.from(0)),
          },
        },
      });

      const result = pricingEngine(store, 1);
      expect(result.weightedAveragePrice.toString()).to.equal('0');
    });

    it('should skip pools with zero target weight and zero available capacity', () => {
      const { poolProducts } = createDefaultStore().getState();
      const store = modifyStore({
        poolProducts: {
          '1_1': {
            ...poolProducts['1_1'],
            targetWeight: BigNumber.from(0),
            trancheCapacities: Array(8).fill(BigNumber.from(0)),
          },
          '1_2': poolProducts['1_2'],
          '1_3': {
            ...poolProducts['1_2'],
            poolId: 3,
            targetPrice: BigNumber.from(400),
            trancheCapacities: [
              ...Array(7).fill(BigNumber.from(0)),
              BigNumber.from('3000000000000000000'), // 3 NXM
            ],
          },
        },
        productPoolIds: { 1: [1, 2, 3] },
      });

      const result = pricingEngine(store, 1);

      expect(result.pricePerPool).to.have.length(2);
      expect(result.pricePerPool[0].poolId).to.equal(2);
      expect(result.pricePerPool[1].poolId).to.equal(3);
      expect(result.weightedAveragePrice.toString()).to.equal('360');
    });
  });

  describe('edge cases', () => {
    it('should handle very large capacity numbers', () => {
      const { poolProducts } = createDefaultStore().getState();
      const store = modifyStore({
        poolProducts: {
          '1_1': {
            ...poolProducts['1_1'],
            targetPrice: parseEther('1'),
            trancheCapacities: [
              ...Array(7).fill(BigNumber.from(0)),
              parseEther('1500'), // 1500 NXM total
            ],
          },
        },
        productPoolIds: { 1: [1] },
      });

      const result = pricingEngine(store, 1);
      expect(result.weightedAveragePrice.toString()).to.equal(parseEther('1').toString());
    });

    it('should handle decimal division correctly with BigNumber', () => {
      const { poolProducts } = createDefaultStore().getState();
      const store = modifyStore({
        poolProducts: {
          '1_1': {
            ...poolProducts['1_1'],
            targetPrice: BigNumber.from(100),
            trancheCapacities: [
              ...Array(7).fill(BigNumber.from(0)),
              parseEther('4'), // 4 NXM available
            ],
          },
          '1_2': {
            ...poolProducts['1_2'],
            targetPrice: BigNumber.from(200),
            trancheCapacities: [
              ...Array(7).fill(BigNumber.from(0)),
              parseEther('3'), // 3 NXM available
            ],
          },
        },
      });

      const result = pricingEngine(store, 1);
      expect(result.weightedAveragePrice.toString()).to.equal('142');
    });
  });
});
