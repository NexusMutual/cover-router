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
    const amount = parseEther('1');

    const [quote] = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 0);

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
      expect(quote.premiumInNxm.toString()).to.be.equal('218367123287671232');
      expect(quote.premiumInAsset.toString()).to.be.equal('6272473115500008728');
      expect(quote.coverAmountInNxm.toString()).to.be.equal('132840000000000000000');
      expect(quote.coverAmountInAsset.toString()).to.be.equal('3815754478595838658197');
    }

    {
      const quote = quotes[1];

      console.log(quote.premiumInNxm.toString());

      expect(quote.poolId).to.be.equal(2);
      expect(quote.premiumInNxm.toString()).to.be.equal('468378082191780821');
      expect(quote.premiumInAsset.toString()).to.be.equal('13453897657327743831');
      expect(quote.coverAmountInNxm.toString()).to.be.equal('284930000000000000000');
      expect(quote.coverAmountInAsset.toString()).to.be.equal('8184454408207710846734');
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
});
