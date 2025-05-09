const { expect } = require('chai');
const ethers = require('ethers');
const express = require('express');
const supertest = require('supertest');

const { calculateProductDataForTranche } = require('../../../src/lib/helpers');
const pricingRouter = require('../../../src/routes/pricing');
const initApp = require('../../mocks/server');
const mockStore = require('../../mocks/store');

const { BigNumber } = ethers;

describe('Pricing Routes', () => {
  let server;

  beforeEach(() => {
    const app = initApp();
    server = supertest(app);
  });

  describe('GET /v2/pricing/products/:productId', () => {
    it('should return pricing data for a valid product', async () => {
      const response = await server.get('/v2/pricing/products/1').expect('Content-Type', /json/).expect(200);
      expect(response.body).to.deep.equal({
        productId: 1,
        pricePerPool: [
          {
            poolId: 1,
            targetPrice: mockStore.poolProducts['1_1'].targetPrice.toNumber(),
          },
          {
            poolId: 2,
            targetPrice: mockStore.poolProducts['1_2'].targetPrice.toNumber(),
          },
        ],
        weightedAveragePrice: 200,
      });
    });

    it('should return 400 for invalid product id', async () => {
      const response = await server.get('/v2/pricing/products/-1').expect('Content-Type', /json/).expect(400);

      expect(response.body).to.deep.equal({
        message: 'Invalid productId: must be an integer',
      });
    });

    it('should return 404 for non-existent product', async () => {
      const response = await server.get('/v2/pricing/products/999').expect('Content-Type', /json/).expect(404);

      expect(response.body).to.deep.equal({
        message: 'Product not found',
      });
    });

    it('should handle product with no pools', async () => {
      // Create a temporary store with a product that has no pools
      const tempStore = {
        ...mockStore,
        productPoolIds: {
          ...mockStore.productPoolIds,
          999: [],
        },
        products: {
          ...mockStore.products,
          999: {
            id: 999,
            productType: 0,
            useFixedPrice: false,
            gracePeriod: 30,
          },
        },
      };

      const tempApp = express();
      tempApp.set('store', { getState: () => tempStore });
      tempApp.use('/v2', pricingRouter);

      const response = await supertest(tempApp)
        .get('/v2/pricing/products/999')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).to.deep.equal({
        message: 'Product not found',
      });
    });

    it('should handle product with multiple pools and different prices', async () => {
      const pools = ['4_18', '4_22', '4_1'];
      let totalWeight = BigNumber.from(0);
      let weightedSum = BigNumber.from(0);

      const productPools = pools.map(poolKey => mockStore.poolProducts[poolKey]);
      const now = BigNumber.from(Math.floor(Date.now() / 1000));

      // Use the actual calculateProductDataForTranche function
      const { capacityPerPool } = calculateProductDataForTranche(
        productPools,
        0, // use trancheIndex 0 to include all active tranches in price calculation
        false, // useFixedPrice
        now,
        mockStore.assets,
        mockStore.assetRates,
      );

      pools.forEach((poolKey, index) => {
        const pool = mockStore.poolProducts[poolKey];
        const availableCapacityNXM =
          capacityPerPool[index].availableCapacity.find(c => c.assetId === 255)?.amount || BigNumber.from(0);

        totalWeight = totalWeight.add(availableCapacityNXM);
        weightedSum = weightedSum.add(pool.targetPrice.mul(availableCapacityNXM));
      });

      const expectedWeightedAverage = totalWeight.isZero() ? 0 : weightedSum.div(totalWeight).toNumber();

      const response = await server.get('/v2/pricing/products/4').expect('Content-Type', /json/).expect(200);

      expect(response.body).to.deep.equal({
        productId: 4,
        pricePerPool: [
          {
            poolId: 18,
            targetPrice: mockStore.poolProducts['4_18'].targetPrice.toNumber(),
          },
          {
            poolId: 22,
            targetPrice: mockStore.poolProducts['4_22'].targetPrice.toNumber(),
          },
          {
            poolId: 1,
            targetPrice: mockStore.poolProducts['4_1'].targetPrice.toNumber(),
          },
        ],
        weightedAveragePrice: expectedWeightedAverage,
      });
    });
  });

  describe('Error handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // Create an app that throws an error
      const errorApp = express();
      errorApp.set('store', {
        getState: () => {
          throw new Error('Internal error');
        },
      });
      errorApp.use('/v2', pricingRouter);

      const response = await supertest(errorApp)
        .get('/v2/pricing/products/1')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).to.deep.equal({
        message: 'Internal Server Error',
      });
    });
  });
});
