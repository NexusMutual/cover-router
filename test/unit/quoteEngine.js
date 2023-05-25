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

  it('should return quote in ETH for product 1 for 1 ETH for minimal cover period', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const productId = 1;
    const amount = BigNumber.from(3000);

    const [quote] = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 0);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('16438356164383');
    expect(quote.premiumInAsset.toString()).to.be.equal('168986963910');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('291827');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('3000');
  });

  it('should return quote in ETH for product 1 for minimal cover period', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const productId = 1;
    const amount = BigNumber.from(30);

    const [quote] = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 0);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('16438356164383');
    expect(quote.premiumInAsset.toString()).to.be.equal('168986963910');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('2918');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('30');
  });

  it('should return quote in DAI for product 1 for minimal cover period', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const productId = 1;
    const amount = BigNumber.from(30);

    const [quote] = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('16438356164383');
    expect(quote.premiumInAsset.toString()).to.be.equal('472182559131270');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('1');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('30');
  });

  it('should return quote with split across 2 pools', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const productId = 1;
    const amount = parseEther('5000');

    const quotes = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    {
      const quote = quotes[0];

      expect(quote.poolId).to.be.equal(1);
      expect(quote.premiumInNxm.toString()).to.be.equal('72443835616438356');
      expect(quote.premiumInAsset.toString()).to.be.equal('2080908538091579231');
      expect(quote.coverAmountInNxm.toString()).to.be.equal('174067803294414078821');
      expect(quote.coverAmountInAsset.toString()).to.be.equal('5000000000000000000000');
    }

    {
      const quote = quotes[1];

      expect(quote.poolId).to.be.equal(2);
      expect(quote.premiumInNxm.toString()).to.be.equal('213698630136986301');
      expect(quote.premiumInAsset.toString()).to.be.equal('6138373268706723400');
      expect(quote.coverAmountInNxm.toString()).to.be.equal('174067803294414078821');
      expect(quote.coverAmountInAsset.toString()).to.be.equal('5000000000000000000000');
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
    expect(quote.coverAmountInNxm.toString()).to.be.equal('97275883204435535361');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000000000000000000');
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
});
