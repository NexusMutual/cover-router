const { expect } = require('chai');
const supertest = require('supertest');
const ethers = require('ethers');

const initApp = require('../../mocks/server');
const { quote } = require('../responses');

const { parseEther } = ethers.utils;

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
        amount: parseEther('1'),
        period: 365,
        coverAsset: 0,
        paymentAsset: 0,
      })
      .expect('Content-Type', /json/)
      .expect(200);
    expect(response).to.be.deep.equal(quote);
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
