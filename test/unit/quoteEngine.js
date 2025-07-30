const { expect } = require('chai');
const {
  utils: { parseEther, parseUnits },
} = require('ethers');
const { BigNumber } = require('ethers');

const { MIN_COVER_PERIOD, TRANCHE_DURATION, SECONDS_PER_DAY } = require('../../src/lib/constants');
const { quoteEngine } = require('../../src/lib/quoteEngine');
const mockStore = require('../mocks/store');

describe('Quote Engine tests', () => {
  const store = { getState: () => mockStore };

  it('should return quote in ETH for product 1 for 1 ETH for minimal cover period', () => {
    const productId = 1;
    const amount = parseEther('1');

    const {
      poolsWithPremium: [quote],
    } = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 0);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('159912328767123287');
    expect(quote.premiumInAsset.toString()).to.be.equal('1643905184916703');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('97280000000000000000');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000042320824328192');
  });

  it('should return quote in DAI for product 1 for minimal cover period', () => {
    const productId = 1;
    const amount = parseEther('1000');

    const {
      poolsWithPremium: [quote],
    } = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('57238356164383561');
    expect(quote.premiumInAsset.toString()).to.be.equal('1644139670895139282');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('34820000000000000000');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000184966461209741632');
  });

  it('should return quote in USDC for product 1 for minimal cover period', () => {
    const productId = 1;
    const amount = parseUnits('1000', 6);

    const {
      poolsWithPremium: [quote],
    } = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 6);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('57238356164383561');
    expect(quote.premiumInAsset.toString()).to.be.equal('1644139');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('34820000000000000000');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000184965');
  });

  it('should return quote with split across 2 pools', () => {
    const productId = 1;
    const amount = parseEther('12000');

    const { poolsWithPremium: quotes } = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    {
      const quote = quotes[0];

      expect(quote.poolId).to.be.equal(1);

      expect(quote.premiumInNxm.toString()).to.be.equal('242387506849315068');
      expect(quote.premiumInAsset.toString()).to.be.equal('6962445158205009701');
      expect(quote.coverAmountInNxm.toString()).to.be.equal('147452400000000000000');
      expect(quote.coverAmountInAsset.toString()).to.be.equal('4235487471241380910599');
    }

    {
      const quote = quotes[1];

      expect(quote.poolId).to.be.equal(2);

      expect(quote.premiumInNxm.toString()).to.be.equal('444357698630136986');
      expect(quote.premiumInAsset.toString()).to.be.equal('12763925614622742886');
      expect(quote.coverAmountInNxm.toString()).to.be.equal('270317600000000000000');
      expect(quote.coverAmountInAsset.toString()).to.be.equal('7764721415562168594332');
    }
  });

  it('should return quote for a product with fixed price', () => {
    const productId = 2;
    const amount = parseEther('1');

    const {
      poolsWithPremium: [quote],
    } = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 0);

    expect(quote.poolId).to.be.equal(1);
    expect(quote.premiumInNxm.toString()).to.be.equal('159912328767123287');
    expect(quote.premiumInAsset.toString()).to.be.equal('1643905184916703');
    expect(quote.coverAmountInNxm.toString()).to.be.equal('97280000000000000000');
    expect(quote.coverAmountInAsset.toString()).to.be.equal('1000042320824328192');
  });

  it('should return return allocation in order of custom pool priority for productId 4', () => {
    const productId = 4;
    const amount = parseEther('102000');

    const {
      poolsWithPremium: [quote1, quote2, quote3],
    } = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1);

    expect(quote1.poolId).to.be.equal(18); // capacity filled
    expect(quote1.premiumInNxm.toString()).to.be.equal('2740621019178082191');
    expect(quote1.premiumInAsset.toString()).to.be.equal('78722801325373825281');
    expect(quote1.coverAmountInNxm.toString()).to.be.equal('1667211120000000000000');
    expect(quote1.coverAmountInAsset.toString()).to.be.equal('47889704139602410393499');

    expect(quote2.poolId).to.be.equal(22); // capacity filled
    expect(quote2.premiumInNxm.toString()).to.be.equal('3044672827397260273');
    expect(quote2.premiumInAsset.toString()).to.be.equal('87456518947607277504');
    expect(quote2.coverAmountInNxm.toString()).to.be.equal('1852175970000000000000');
    expect(quote2.coverAmountInAsset.toString()).to.be.equal('53202715693127760499173');

    expect(quote3.poolId).to.be.equal(1); // partially filled
    expect(quote3.premiumInNxm.toString()).to.be.equal('51949989041095890');
    expect(quote3.premiumInAsset.toString()).to.be.equal('1492234291979572267');
    expect(quote3.coverAmountInNxm.toString()).to.be.equal('31602910000000000000');
    expect(quote3.coverAmountInAsset.toString()).to.be.equal('907775860954239803444');
  });

  it('should return empty array for cover over the capacity', () => {
    const productId = 1;
    const amount = parseEther('300000');

    expect(() => quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1)).to.throw(
      'Not enough capacity for the cover amount',
    );
  });

  it('should return null non existing product', () => {
    const productId = 999;
    const amount = BigNumber.from(30);

    expect(() => quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1)).to.throw('Invalid Product Id');
  });

  it('should account for capacity deallocation when editing a cover which started in an active tranche', () => {
    const productId = 4;
    const amount = parseEther('102000');

    const now = BigNumber.from(Date.now()).div(1000);
    mockStore.covers[1].start = now.toNumber();

    const quote = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1, 1);
    const [quote1, quote2] = quote.poolsWithPremium;

    expect(quote.poolsWithPremium.length).to.equal(2);

    expect(quote1.poolId).to.be.equal(18); // capacity filled
    expect(quote1.premiumInNxm.toString()).to.be.equal('2921262115068493150');
    expect(quote1.premiumInAsset.toString()).to.be.equal('83911615467667531712');
    expect(quote1.coverAmountInNxm.toString()).to.be.equal('1777101120000000000000');
    expect(quote1.coverAmountInAsset.toString()).to.be.equal('51046232742831081803837');

    expect(quote2.poolId).to.be.equal(22); // partially filled
    expect(quote2.premiumInNxm.toString()).to.be.equal('2915981720547945205');
    expect(quote2.premiumInAsset.toString()).to.be.equal('83759939097293143370');
    expect(quote2.coverAmountInNxm.toString()).to.be.equal('1773888880000000000000');
    expect(quote2.coverAmountInAsset.toString()).to.be.equal('50953962950853328892279');
  });

  // TODO: check out the starting tranche of edited cover mockStore.covers[1].start
  //       sometimes it fails when we are at the beginning of a tranche
  it('should account for capacity deallocation when editing a cover which started in a previous tranche', () => {
    const productId = 4;
    const amount = parseEther('102000');

    const now = BigNumber.from(Date.now()).div(1000);

    mockStore.covers[1].start = now.sub(TRANCHE_DURATION + 7 * SECONDS_PER_DAY).toNumber();

    const quote = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1, 1);
    const [quote1, quote2, quote3] = quote.poolsWithPremium;

    expect(quote.poolsWithPremium.length).to.equal(3);

    expect(quote1.poolId).to.be.equal(18); // capacity filled
    expect(quote1.premiumInNxm.toString()).to.be.equal('2757042936986301369');
    expect(quote1.premiumInAsset.toString()).to.be.equal('79194511701945980409');
    expect(quote1.coverAmountInNxm.toString()).to.be.equal('1677201120000000000000');
    expect(quote1.coverAmountInAsset.toString()).to.be.equal('48176661285350471430803');

    expect(quote2.poolId).to.be.equal(22); // capacity filled
    expect(quote2.premiumInNxm.toString()).to.be.equal('3061094745205479452');
    expect(quote2.premiumInAsset.toString()).to.be.equal('87928229324179432661');
    expect(quote2.coverAmountInNxm.toString()).to.be.equal('1862165970000000000000');
    expect(quote2.coverAmountInAsset.toString()).to.be.equal('53489672838875821536476');

    expect(quote3.poolId).to.be.equal(1); // partially filled
    expect(quote3.premiumInNxm.toString()).to.be.equal('19106153424657534');
    expect(quote3.premiumInAsset.toString()).to.be.equal('548813538835262012');
    expect(quote3.coverAmountInNxm.toString()).to.be.equal('11622910000000000000');
    expect(quote3.coverAmountInAsset.toString()).to.be.equal('333861569458117728837');
  });

  it('should calculate full discount for edited cover that started now', () => {
    const productId = 4;
    const amount = parseEther('102000');

    const now = BigNumber.from(Date.now()).div(1000);
    mockStore.covers[1].start = now.toNumber();

    const quote = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1, 1);

    expect(quote.refundInNXM.toString()).to.equal('55000000000000000000');
    expect(quote.refundInAsset.toString()).to.equal('1579844145760095800970');
  });

  it('should calculate half discount for edited cover which is at half period', () => {
    const productId = 4;
    const amount = parseEther('102000');

    const now = BigNumber.from(Date.now()).div(1000);
    mockStore.covers[1].start = now.sub(Math.floor(mockStore.covers[1].period / 2)).toNumber();

    const quote = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1, 1);

    expect(quote.refundInNXM.toString()).to.equal('27500000000000000000');
    expect(quote.refundInAsset.toString()).to.equal('789922072880047900485');
  });

  it('should return error if not original cover id passed', () => {
    const productId = 4;
    const amount = parseEther('102000');

    expect(() => quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1, 2)).to.throw('Not original cover id');
  });
});
