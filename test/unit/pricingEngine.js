const { expect } = require('chai');
const ethers = require('ethers');

const { pricingEngine } = require('../../src/lib/pricingEngine');
const mockStore = require('../mocks/store');

const { BigNumber } = ethers;
const { parseEther } = ethers.utils;

describe('pricingEngine', () => {
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
      const store = createMockStore({
        '1_1': mockStore.poolProducts['1_1'],
      });

      const result = pricingEngine(store, 1);
      expect(result).to.deep.equal({
        productId: 1,
        pricePerPool: [
          {
            poolId: 1,
            targetPrice: mockStore.poolProducts['1_1'].targetPrice,
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
      expect(result.weightedAveragePrice).to.deep.equal(BigNumber.from(125));
      expect(result.pricePerPool).to.have.length(2);
    });

    it('should handle pools with zero capacity', () => {
      const store = createMockStore({
        '1_1': {
          ...mockStore.poolProducts['1_1'],
          targetPrice: BigNumber.from(100),
          allocations: Array(8).fill(BigNumber.from(0)),
          trancheCapacities: Array(8).fill(BigNumber.from(0)),
        },
        '1_2': {
          ...mockStore.poolProducts['1_2'],
          targetPrice: BigNumber.from(200),
          allocations: Array(8).fill(BigNumber.from(0)),
          trancheCapacities: [...Array(7).fill(BigNumber.from(0)), BigNumber.from(100)],
        },
      });

      const result = pricingEngine(store, 1);
      // Only pool 2 should contribute to weighted average
      expect(result.weightedAveragePrice).to.deep.equal(BigNumber.from(200));
    });

    it('should handle all pools having zero capacity', () => {
      const store = createMockStore({
        '1_1': {
          ...mockStore.poolProducts['1_1'],
          targetPrice: BigNumber.from(100),
          allocations: Array(8).fill(BigNumber.from(0)),
          trancheCapacities: Array(8).fill(BigNumber.from(0)),
        },
        '1_2': {
          ...mockStore.poolProducts['1_2'],
          targetPrice: BigNumber.from(200),
          allocations: Array(8).fill(BigNumber.from(0)),
          trancheCapacities: Array(8).fill(BigNumber.from(0)),
        },
      });

      const result = pricingEngine(store, 1);
      // Weighted average: (0 * 100 + 0 * 200) / (0 + 0) = 0
      expect(result.weightedAveragePrice).to.deep.equal(BigNumber.from(0));
    });
  });

  describe('edge cases', () => {
    it('should handle very large capacity numbers', () => {
      const store = createMockStore({
        '1_1': {
          ...mockStore.poolProducts['1_1'],
          targetPrice: parseEther('1'),
          allocations: Array(8).fill(BigNumber.from(0)),
          trancheCapacities: [
            ...Array(7).fill(BigNumber.from(0)),
            parseEther('1500'), // 1500 NXM total
          ],
        },
      });

      const result = pricingEngine(store, 1);
      // Weighted average: (1000000000000000000 * 1500) / 1500 = 1000000000000000000
      expect(result.weightedAveragePrice).to.deep.equal(parseEther('1'));
    });

    it('should handle decimal division correctly with BigNumber', () => {
      const store = createMockStore({
        '1_1': {
          ...mockStore.poolProducts['1_1'],
          targetPrice: BigNumber.from(100),
          allocations: Array(8).fill(BigNumber.from(0)),
          trancheCapacities: [
            ...Array(7).fill(BigNumber.from(0)),
            parseEther('4'), // 4 NXM available
          ],
        },
        '1_2': {
          ...mockStore.poolProducts['1_2'],
          targetPrice: BigNumber.from(200),
          allocations: Array(8).fill(BigNumber.from(0)),
          trancheCapacities: [
            ...Array(7).fill(BigNumber.from(0)),
            parseEther('3'), // 3 NXM available
          ],
        },
      });

      const result = pricingEngine(store, 1);
      // Weighted average: (100 * 4 + 200 * 3) / (4 + 3) = (400 + 600) / 7 = 1000 / 7 ≈ 142.857... = 140
      expect(result.weightedAveragePrice).to.deep.equal(BigNumber.from(142));
    });
  });
});
