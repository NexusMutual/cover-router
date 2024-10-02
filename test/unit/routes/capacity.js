const { expect } = require('chai');
const sinon = require('sinon');
const supertest = require('supertest');

const selectorsModule = require('../../../src/store/selectors');
const initApp = require('../../mocks/server');
const { capacities, poolProductCapacities } = require('../responses');

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
    it('should get all capacities for one product', async function () {
      const productId = 0;
      const url = `/v2/capacity/${productId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(200);
      expect(response).to.be.deep.equal(capacities[0]);
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

    it('should return 404 Pool not found', async function () {
      const nonExistentPoolId = 999;
      const url = `/v2/capacity/pools/${nonExistentPoolId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(404);
      expect(response.error).to.be.equal('Pool not found');
    });
  });

  describe('GET /capacity/pools/:poolId/products/:productId', () => {
    it('should get capacity for a specific product in a specific pool', async function () {
      const poolId = 2;
      const productId = 0;
      const url = `/v2/capacity/pools/${poolId}/products/${productId}`;
      const { body: response } = await server.get(url).expect('Content-Type', /json/).expect(200);
      expect(response).to.be.deep.equal(poolProductCapacities[poolId][productId]);
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
