const { expect } = require('chai');
const supertest = require('supertest');

const riSubnetworks = require('../../../src/store/riSubnetworks.json');
const initApp = require('../../mocks/server');

describe('Symbiotic Routes', () => {
  let server;

  beforeEach(() => {
    const app = initApp();
    server = supertest(app);
  });

  describe('GET /v2/symbiotic', () => {
    it('should return ri subnetworks JSON', async () => {
      const response = await server.get('/v2/symbiotic').expect('Content-Type', /json/).expect(200);

      expect(response.body).to.deep.equal(riSubnetworks);
    });
  });
});
