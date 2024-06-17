const { expect } = require('chai');
const {
  utils: { parseEther, parseUnits },
} = require('ethers');
const { BigNumber } = require('ethers');
const sinon = require('sinon');

const { MIN_COVER_PERIOD } = require('../../src/lib/constants');
const { quoteEngine } = require('../../src/lib/quoteEngine');
const mockStore = require('../mocks/store');

describe('Quote Engine tests', () => {
  const store = { getState: () => mockStore };

  afterEach(function () {
    sinon.restore();
  });

  it('should return quote in ETH for product 1 for 1 ETH for minimal cover period', () => {
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
    const productId = 1;
    const amount = parseEther('1000');

    const [quote] = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('57238356164383561');
    expect(quote.premiumInAsset.toString()).to.be.equal('1644139670895139282');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('34820000000000000000');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000184966461209741632');
  });

  it('should return quote in USDC for product 1 for minimal cover period', () => {
    const productId = 1;
    const amount = parseUnits('1000', 6);

    const [quote] = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 6);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('57238356164383561');
    expect(quote.premiumInAsset.toString()).to.be.equal('1644139');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('34820000000000000000');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000184965');
  });

  it('should return quote with split across 2 pools', () => {
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
    const productId = 2;
    const amount = parseEther('1');

    const [quote] = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 0);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('159912328767123287');
    expect(quote.premiumInAsset.toString()).to.be.equal('1643905184916703');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('97280000000000000000');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000042320824328192');
  });

  it('should return return allocation in order of custom pool priority for productId 4', () => {
    const productId = 4;
    const amount = parseEther('102000');

    const [quote1, quote2, quote3] = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    expect(quote1.poolId).to.be.equal(1); // partially filled
    expect(quote1.premiumInNxm.toString()).to.be.equal('46158904109589041');
    expect(quote1.premiumInAsset.toString()).to.be.equal('1325888626040652254');
    expect(quote1.coverAmountInNxm.toString()).to.be.equal('28080000000000000000');
    expect(quote1.coverAmountInAsset.toString()).to.be.equal('806582247508063456204');

    expect(quote2.poolId).to.be.equal(18); // capacity filled
    expect(quote2.premiumInNxm.toString()).to.be.equal('10973457534246575342');
    expect(quote2.premiumInAsset.toString()).to.be.equal('315206411713208509713');
    expect(quote2.coverAmountInNxm.toString()).to.be.equal('1668880000000000000000');
    expect(quote2.coverAmountInAsset.toString()).to.be.equal('47937641781383794187687');

    expect(quote3.poolId).to.be.equal(22); // capacity filled
    expect(quote3.premiumInNxm.toString()).to.be.equal('11809917123287671232');
    expect(quote3.premiumInAsset.toString()).to.be.equal('339233244166144344759');
    expect(quote3.coverAmountInNxm.toString()).to.be.equal('1854030000000000000000');
    expect(quote3.coverAmountInAsset.toString()).to.be.equal('53255971664792553052225');
  });

  it('should return empty array for cover over the capacity', () => {
    const productId = 1;
    const amount = parseEther('300000');

    const quotes = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    expect(quotes.length).to.be.equal(0);
  });

  it('should return null non existing product', () => {
    const productId = 999;
    const amount = BigNumber.from(30);

    const quote = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    expect(quote).to.be.equal(null);
  });
});
