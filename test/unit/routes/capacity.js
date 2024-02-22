const { expect } = require('chai');
const supertest = require('supertest');
const initApp = require('../../mocks/server');
const { capacities } = require('../responses');

describe('GET /capacity', async () => {
  let server;
  before(() => {
    const app = initApp();
    server = supertest(app);
  });

  it('should get all capacities for products', async function () {
    const { body: response } = await server.get('/v2/capacity').expect('Content-Type', /json/).expect(200);
    expect(response).to.be.deep.equal(capacities);
  });

  it('should get all capacities for one product', async function () {
    const productId = 0;
    const { body: response } = await server.get(`/v2/capacity/${productId}`).expect('Content-Type', /json/).expect(200);
    expect(response).to.be.deep.equal(capacities[0]);
  });

  it('should throw an error if product is non-existant', async function () {
    const productId = 5;
    const {
      body: { error },
    } = await server.get(`/v2/capacity/${productId}`).expect('Content-Type', /json/).expect(400);
    expect(error).to.be.equal('Invalid Product Id');
  });
});
