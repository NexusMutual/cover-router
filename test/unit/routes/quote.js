const { expect } = require('chai');
const ethers = require('ethers');
const { parseUnits } = require('ethers/lib/utils');
const supertest = require('supertest');

const initApp = require('../../mocks/server');
const { getQuote } = require('../responses');

const { parseEther } = ethers.utils;

const ETH_ASSET_ID = 0;
const DAI_ASSET_ID = 1;
const USDC_ASSET_ID = 6;

describe('GET /quote', () => {
  let server;
  before(() => {
    const app = initApp();
    server = supertest(app);
  });

  it('should successfully get a quote for coverAsset 0 - ETH', async function () {
    const { body: response } = await server
      .get('/v2/quote')
      .query({
        productId: 0,
        amount: parseEther('0.1'),
        period: 365,
        coverAsset: ETH_ASSET_ID,
        paymentAsset: 0,
      })
      .expect('Content-Type', /json/)
      .expect(200);
    expect(response).to.be.deep.equal(getQuote(ETH_ASSET_ID));
    console.log(response);
  });

  it('should successfully get a quote for coverAsset 1 - DAI', async function () {
    const { body: response } = await server
      .get('/v2/quote')
      .query({
        productId: 0,
        amount: parseEther('1'),
        period: 365,
        coverAsset: DAI_ASSET_ID,
        paymentAsset: 0,
      })
      .expect('Content-Type', /json/)
      .expect(200);
    expect(response).to.be.deep.equal(getQuote(DAI_ASSET_ID));
  });

  it('should successfully get a quote for coverAsset 6 - USDC', async function () {
    const { body: response } = await server
      .get('/v2/quote')
      .query({
        productId: 0,
        amount: parseUnits('10', 6),
        period: 365,
        coverAsset: USDC_ASSET_ID,
        paymentAsset: 0,
      })
      .expect('Content-Type', /json/)
      .expect(200);
    expect(response).to.be.deep.equal(getQuote(USDC_ASSET_ID));
  });

  it('should fail get a quote for cover over the capacity', async function () {
    const {
      body: { message },
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
    expect(message).to.be.equal('Not enough capacity for the cover amount');
  });

  it('should return 400 error for invalid productId', async function () {
    const {
      body: { message },
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
    expect(message).to.be.equal('Invalid Product Id');
  });
});
