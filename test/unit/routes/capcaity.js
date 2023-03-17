const { expect } = require('chai');
const supertest = require('supertest');
const initApp = require('../../mocks/server');

const capacitiesResponse = [
  {
    productId: 0,
    capacity: [
      {
        assetId: 0,
        amount: '4761714669056628480',
      },
      {
        assetId: 1,
        amount: '13305160151201388636532',
      },
      {
        assetId: 255,
        amount: '463200000000000000000',
      },
    ],
  },
  {
    productId: 1,
    capacity: [
      {
        assetId: 0,
        amount: '2380857334528314240',
      },
      {
        assetId: 1,
        amount: '6652580075600694318266',
      },
      {
        assetId: 255,
        amount: '231600000000000000000',
      },
    ],
  },
  {
    productId: 2,
    capacity: [
      {
        assetId: 0,
        amount: '4761714669056628480',
      },
      {
        assetId: 1,
        amount: '13305160151201388636532',
      },
      {
        assetId: 255,
        amount: '463200000000000000000',
      },
    ],
  },
];
describe('GET /capacity', async () => {
  let server;
  before(() => {
    const app = initApp();
    server = supertest(app);
  });

  it('should get all capacities for products', async function () {
    const { body: response } = await server.get('/v2/capacity').expect('Content-Type', /json/).expect(200);
    expect(response).to.be.deep.equal(capacitiesResponse);
  });

  it('should get all capacities for one product', async function () {
    const productId = 0;
    const { body: response } = await server.get(`/v2/capacity/${productId}`).expect('Content-Type', /json/).expect(200);
    expect(response).to.be.deep.equal(capacitiesResponse[0]);
  });

  it('should throw an error if product is non-existant', async function () {
    const productId = 5;
    const {
      body: { error },
    } = await server.get(`/v2/capacity/${productId}`).expect('Content-Type', /json/).expect(400);
    expect(error).to.be.equal('Invalid Product Id');
  });
});
