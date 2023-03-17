const { expect } = require('chai');
const supertest = require('supertest');
const initApp = require('../../mocks/server');
const {
  ethers: {
    utils: { parseEther },
  },
} = require('ethers');

const quoteResponse = {
  quote: {
    premiumInNXM: '200000000000000',
    premiumInAsset: '2056008060905',
    poolAllocationRequests: [
      {
        poolId: '1',
        coverAmountInAsset: '30000',
        skip: false,
      },
    ],
  },
  capacities: [
    {
      poolId: 1,
      capacity: [
        {
          assetId: '0',
          amount: '1011555965965397760',
        },
        {
          assetId: '1',
          amount: '2826484798959880487553',
        },
        {
          assetId: '255',
          amount: '98400000000000000000',
        },
      ],
    },
  ],
};

describe('GET /quote', async () => {
  let server;
  before(() => {
    const app = initApp();
    server = supertest(app);
  });

  it('should successfully get a quote', async function () {
    const { body: response } = await server
      .get('/v2/quote')
      .query({
        productId: 0,
        amount: 30000,
        period: 365,
        coverAsset: 0,
        paymentAsset: 0,
      })
      .expect('Content-Type', /json/)
      .expect(200);
    expect(response).to.be.deep.equal(quoteResponse);
  });

  it('should fail get a quote for cover over the capacity', async function () {
    const {
      body: { error },
    } = await server
      .get('/v2/quote')
      .query({
        productId: 0,
        amount: parseEther('3000000'),
        period: 365,
        coverAsset: 0,
        paymentAsset: 0,
      })
      .expect('Content-Type', /json/)
      .expect(400);
    expect(error).to.be.equal('Not enough capacity for the cover amount');
  });

  it('should successfully get a quote', async function () {
    const {
      body: { error },
    } = await server
      .get('/v2/quote')
      .query({
        productId: 5,
        amount: parseEther('3000000'),
        period: 365,
        coverAsset: 0,
        paymentAsset: 0,
      })
      .expect('Content-Type', /json/)
      .expect(400);
    expect(error).to.be.equal('Invalid Product Id');
  });
});
