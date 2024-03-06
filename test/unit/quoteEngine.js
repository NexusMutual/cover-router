const sinon = require('sinon');
const {
  utils: { parseEther },
} = require('ethers');
const { expect } = require('chai');
const { quoteEngine } = require('../../src/lib/quoteEngine');
const mockStore = require('../mocks/store');
const { BigNumber } = require('ethers');
const { MIN_COVER_PERIOD } = require('../../src/lib/constants');

describe('Quote Engine tests', () => {
  const store = { getState: () => null };

  afterEach(function () {
    sinon.restore();
  });

  it('should return quote in ETH for product 1 for 1 ETH for minimal cover period', async () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const productId = 1;
    const amount = parseEther('1');

    const [quote] = await quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 0);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('159912328767123287');
    expect(quote.premiumInAsset.toString()).to.be.equal('1643905184916703');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('97280000000000000000');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000042320824328192');
  });

  it('should return quote in DAI for product 1 for minimal cover period', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const productId = 1;
    const amount = parseEther('1000');

    const [quote] = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('57238356164383561');
    expect(quote.premiumInAsset.toString()).to.be.equal('1644139670895139282');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('34820000000000000000');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000184966461209741632');
  });

  it('should return quote with split across 2 pools', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const productId = 1;
    const amount = parseEther('12000');

    const quotes = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    {
      const quote = quotes[0];

      expect(quote.poolId).to.be.equal(1);
      expect(quote.premiumInNxm.toString()).to.be.equal('114467496018364672');
      expect(quote.premiumInAsset.toString()).to.be.equal('3288014608444190956');
      expect(quote.coverAmountInNxm.toString()).to.be.equal('69634393411171842357');
      expect(quote.coverAmountInAsset.toString()).to.be.equal('2000208886803549504936');
    }

    {
      const quote = quotes[1];

      expect(quote.poolId).to.be.equal(2);
      expect(quote.premiumInNxm.toString()).to.be.equal('660746136029943252');
      expect(quote.premiumInAsset.toString()).to.be.equal('18979562088009268270');
      expect(quote.coverAmountInNxm.toString()).to.be.equal('348135606588828157643');
      expect(quote.coverAmountInAsset.toString()).to.be.equal('9999999999999999999995');
    }
  });

  it('should return quote for a product with fixed price', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const productId = 2;
    const amount = parseEther('1');

    const [quote] = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 0);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('159912328767123287');
    expect(quote.premiumInAsset.toString()).to.be.equal('1643905184916703');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('97280000000000000000');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000042320824328192');
  });

  it('should return empty array for cover over the capacity', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const productId = 1;
    const amount = parseEther('300000');

    const quotes = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    expect(quotes.length).to.be.equal(0);
  });

  it('should return null non existing product', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const productId = 3;
    const amount = BigNumber.from(30);

    const quote = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    expect(quote).to.be.equal(null);
  });

  it('should return quote in ETH for product 1 for 2 ETH for minimal cover period for an existing cover with 1 allocation', async () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const productId = 1;
    const amount = parseEther('1');

    const coverId = Number(0);

    const [quote] = await quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 0, coverId);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('159912328767123287');
    expect(quote.premiumInAsset.toString()).to.be.equal('1643905184916703');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('97280000000000000000');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000042320824328192');
  });
});
