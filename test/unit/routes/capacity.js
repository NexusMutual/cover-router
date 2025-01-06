const { expect } = require('chai');
const supertest = require('supertest');

const initApp = require('../../mocks/server');
const { capacities, poolProductCapacities, productCapacityPerPools } = require('../responses');

describe('Capacity Routes', () => {
  let server;
  let selectProductStub;

  beforeEach(() => {
    const app = initApp();
    server = supertest(app);
  });

  afterEach(() => {
    if (selectProductStub) {
      selectProductStub.restore();
    }
  });

  describe('GET /capacity', () => {
    it('should get all capacities for products', async function () {
      const url = '/v2/capacity';
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(200);
      expect(response).to.be.deep.equal(capacities);
    });

    it('should return 400 Invalid period', async function () {
      const invalidPeriod = 10;
      const url = `/v2/capacity?period=${invalidPeriod}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(400);
      expect(response.error).to.be.equal('Invalid period: must be an integer between 28 and 365');
    });
  });

  describe('GET /capacity/:productId', () => {
    it('should get all capacities for the specified productId', async function () {
      const productId = 0;
      const url = `/v2/capacity/${productId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(200);

      const expectedCapacity = capacities[productId];
      expectedCapacity.capacityPerPool = productCapacityPerPools[productId];

      expect(response).to.be.deep.equal(expectedCapacity);
    });

    it('should return 400 Invalid Product Id for non-existent productId', async function () {
      const nonExistentProductId = 999;
      const url = `/v2/capacity/${nonExistentProductId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(400);
      expect(response.error).to.be.equal('Invalid Product Id');
    });

    it('should return 400 Invalid productId if the productId is not an integer', async function () {
      const invalidProductId = -1;
      const url = `/v2/capacity/${invalidProductId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(400);
      expect(response.error).to.be.equal('Invalid productId: must be an integer');
    });
  });

  describe('GET /capacity/pools/:poolId', () => {
    it('should get all capacities for all products in a specific pool', async function () {
      const poolId = 2;
      const url = `/v2/capacity/pools/${poolId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(200);
      expect(response).to.be.deep.equal(poolProductCapacities[poolId]);
    });

    it('should return 400 Invalid poolId', async function () {
      const invalidPoolId = 0;
      const url = `/v2/capacity/pools/${invalidPoolId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(400);
      expect(response.error).to.be.equal('Invalid poolId: must be a positive integer');
    });

    it('should return 400 Invalid period', async function () {
      const invalidPeriod = 10;
      const poolId = 2;
      const url = `/v2/capacity/pools/${poolId}?period=${invalidPeriod}`;
    const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(400);
      expect(response.error).to.be.equal('Invalid period: must be an integer between 28 and 365');
    });

    it('should return empty productsCapacity and zero utilizationRate for pool with no products', async function () {
      const emptyPoolId = 28;
      const url = `/v2/capacity/pools/${emptyPoolId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(200);

      expect(response.poolId).to.equal(emptyPoolId);
      expect(response.utilizationRate).to.equal(0);
      expect(response.productsCapacity).to.have.lengthOf(0);
    });

    it('should return empty productsCapacity and zero utilizationRate for for non-existent poolId', async function () {
      const invalidPoolId = 28;
      const url = `/v2/capacity/pools/${invalidPoolId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(200);

      expect(response.poolId).to.equal(invalidPoolId);
      expect(response.utilizationRate).to.equal(0);
      expect(response.productsCapacity).to.have.lengthOf(0);
    });
  });

  describe('GET /capacity/pools/:poolId/products/:productId', () => {
    it('should get capacity for a specific product in a specific pool', async function () {
      const poolId = 2;
      const productId = 0;
      const url = `/v2/capacity/pools/${poolId}/products/${productId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(200);
      expect(response).to.be.deep.equal(poolProductCapacities[poolId].productsCapacity[productId]);
    });

    it('should return 400 Invalid productId', async function () {
      const poolId = 2;
      const invalidProductId = -1;
      const url = `/v2/capacity/pools/${poolId}/products/${invalidProductId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(400);
      expect(response.error).to.be.equal('Invalid productId: must be an integer');
    });

    it('should return 400 Invalid poolId', async function () {
      const invalidPoolId = 0;
      const productId = 0;
      const url = `/v2/capacity/pools/${invalidPoolId}/products/${productId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(400);
      expect(response.error).to.be.equal('Invalid poolId: must be a positive integer');
    });

    it('should return 400 Invalid period', async function () {
      const invalidPeriod = 10;
      const poolId = 2;
      const productId = 0;
      const url = `/v2/capacity/pools/${poolId}/products/${productId}?period=${invalidPeriod}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(400);
      expect(response.error).to.be.equal('Invalid period: must be an integer between 28 and 365');
    });

    it('should return 404 Product not found in the specified pool', async function () {
      const poolId = 2;
      const nonExistentProductId = 999;
      const url = `/v2/capacity/pools/${poolId}/products/${nonExistentProductId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(404);
      expect(response.error).to.be.equal('Product not found in the specified pool');
    });
  });
});
