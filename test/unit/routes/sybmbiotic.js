const { expect } = require('chai');
const supertest = require('supertest');

const riSubnetworks = require('../../../src/store/riSubnetworks.json');
const initApp = require('../../mocks/server');

describe('Sybmbiotic Routes', () => {
  let server;

  beforeEach(() => {
    const app = initApp();
    server = supertest(app);
  });

  describe('GET /v2/sybmbiotic', () => {
    it('should return ri subnetworks JSON', async () => {
      const response = await server.get('/v2/sybmbiotic').expect('Content-Type', /json/).expect(200);

      expect(response.body).to.deep.equal(riSubnetworks);
    });
  });
});
