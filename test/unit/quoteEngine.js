const { expect } = require('chai');
const {
  utils: { parseEther, parseUnits },
} = require('ethers');
const { BigNumber } = require('ethers');

const {
  MIN_COVER_PERIOD,
  TRANCHE_DURATION,
  SECONDS_PER_DAY,
  RI_THRESHOLD,
  RI_COVER_AMOUNT_PERCENTAGE,
  RI_COVER_AMOUNT_DENOMINATOR,
} = require('../../src/lib/constants');
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

      expect(quote.premiumInNxm.toString()).to.be.equal('242400000000000000');
      expect(quote.premiumInAsset.toString()).to.be.equal('6962804016949949493');
      expect(quote.coverAmountInNxm.toString()).to.be.equal('147460000000000000000');
      expect(quote.coverAmountInAsset.toString()).to.be.equal('4235705776977885942018');
    }

    {
      const quote = quotes[1];

      expect(quote.poolId).to.be.equal(2);

      expect(quote.premiumInNxm.toString()).to.be.equal('444345205479452054');
      expect(quote.premiumInAsset.toString()).to.be.equal('12763566755877803094');
      expect(quote.coverAmountInNxm.toString()).to.be.equal('270310000000000000000');
      expect(quote.coverAmountInAsset.toString()).to.be.equal('7764503109825663562912');
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
    expect(quote1.premiumInNxm.toString()).to.be.equal('2740635616438356164');
    expect(quote1.premiumInAsset.toString()).to.be.equal('78723220623486333875');
    expect(quote1.coverAmountInNxm.toString()).to.be.equal('1667220000000000000000');
    expect(quote1.coverAmountInAsset.toString()).to.be.equal('47889959212620853114421');

    expect(quote2.poolId).to.be.equal(22); // capacity filled
    expect(quote2.premiumInNxm.toString()).to.be.equal('3044679452054794520');
    expect(quote2.premiumInAsset.toString()).to.be.equal('87456709237178607425');
    expect(quote2.coverAmountInNxm.toString()).to.be.equal('1852180000000000000000');
    expect(quote2.coverAmountInAsset.toString()).to.be.equal('53202831452616986193465');

    expect(quote3.poolId).to.be.equal(1); // partially filled
    expect(quote3.premiumInNxm.toString()).to.be.equal('51928767123287671');
    expect(quote3.premiumInAsset.toString()).to.be.equal('1491624704295733782');
    expect(quote3.coverAmountInNxm.toString()).to.be.equal('31590000000000000000');
    expect(quote3.coverAmountInAsset.toString()).to.be.equal('907405028446571388229');
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
    expect(quote1.premiumInNxm.toString()).to.be.equal('2921276712328767123');
    expect(quote1.premiumInAsset.toString()).to.be.equal('83912034765780040306');
    expect(quote1.coverAmountInNxm.toString()).to.be.equal('1777110000000000000000');
    expect(quote1.coverAmountInAsset.toString()).to.be.equal('51046487815849524524759');

    expect(quote2.poolId).to.be.equal(22); // partially filled
    expect(quote2.premiumInNxm.toString()).to.be.equal('2915967123287671232');
    expect(quote2.premiumInAsset.toString()).to.be.equal('83759519799180634777');
    expect(quote2.coverAmountInNxm.toString()).to.be.equal('1773880000000000000000');
    expect(quote2.coverAmountInAsset.toString()).to.be.equal('50953707877834886171357');
  });

  // TODO: check out the starting tranche of edited cover mockStore.covers[1].start
  //       sometimes it fails when we are at the beginning of a tranche
  it('should account for capacity deallocation when editing a cover which started in a previous tranche', () => {
    const productId = 4;
    const amount = parseEther('102000');

    const now = BigNumber.from(Date.now()).div(1000);

    // Set cover to start in a previous tranche (TRANCHE_DURATION + 14 days ago)
    // but extend period to ensure it's still active
    const startTime = now.sub(TRANCHE_DURATION + 14 * SECONDS_PER_DAY);
    mockStore.covers[1].start = startTime.toNumber();
    // Extend period to ensure cover is still active (original period was 30 days)
    mockStore.covers[1].period = 120 * 24 * 3600; // 120 days to ensure it's still active

    const quote = quoteEngine(store, productId, amount, MIN_COVER_PERIOD, 1, 1);
    const [quote1, quote2, quote3] = quote.poolsWithPremium;

    expect(quote.poolsWithPremium.length).to.equal(3);

    expect(quote1.poolId).to.be.equal(18); // capacity filled
    expect(quote1.premiumInNxm.toString()).to.be.equal('2757057534246575342');
    expect(quote1.premiumInAsset.toString()).to.be.equal('79194931000058489003');
    expect(quote1.coverAmountInNxm.toString()).to.be.equal('1677210000000000000000');
    expect(quote1.coverAmountInAsset.toString()).to.be.equal('48176916358368914151725');

    expect(quote2.poolId).to.be.equal(22); // capacity filled
    expect(quote2.premiumInNxm.toString()).to.be.equal('3061101369863013698');
    expect(quote2.premiumInAsset.toString()).to.be.equal('87928419613750762553');
    expect(quote2.coverAmountInNxm.toString()).to.be.equal('1862170000000000000000');
    expect(quote2.coverAmountInAsset.toString()).to.be.equal('53489788598365047230769');

    expect(quote3.poolId).to.be.equal(1); // partially filled
    expect(quote3.premiumInNxm.toString()).to.be.equal('19084931506849315');
    expect(quote3.premiumInAsset.toString()).to.be.equal('548203951151423527');
    expect(quote3.coverAmountInNxm.toString()).to.be.equal('11610000000000000000');
    expect(quote3.coverAmountInAsset.toString()).to.be.equal('333490736950449313622');
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

  describe('RI Quote Tests', () => {
    const now = BigNumber.from(Date.now()).div(1000);
    const period = MIN_COVER_PERIOD;

    const createRiStore = (
      riSubnetworks,
      vaultProducts,
      activeCoverAmount = null,
      poolCapacityAllocationUnits = null,
    ) => {
      const baseStore = {
        ...mockStore,
        riSubnetworks,
        vaultProducts: {
          ...mockStore.vaultProducts,
          ...vaultProducts,
        },
        riAssetRates: {
          ...(mockStore.riAssetRates || {}),
          0: parseEther('1.2'), // 1 wstETH = 1.2 NXM
        },
        epochExpires: {
          ...(mockStore.epochExpires || {}),
          1: BigNumber.from(Date.now())
            .div(1000)
            .add(365 * 24 * 3600), // Set far in the future to ensure it passes the check
          2: BigNumber.from(Date.now())
            .div(1000)
            .add(365 * 24 * 3600), // Set far in the future to ensure it passes the check
        },
      };

      if (poolCapacityAllocationUnits != null) {
        const cap = BigNumber.from(poolCapacityAllocationUnits);
        baseStore.poolProducts = {
          ...baseStore.poolProducts,
          '1_1': {
            ...baseStore.poolProducts['1_1'],
            trancheCapacities: baseStore.poolProducts['1_1'].trancheCapacities.map((_, i) =>
              i === 7 ? cap : BigNumber.from(0),
            ),
          },
          '1_2': {
            ...baseStore.poolProducts['1_2'],
            trancheCapacities: baseStore.poolProducts['1_2'].trancheCapacities.map((_, i) =>
              i === 7 ? cap : BigNumber.from(0),
            ),
          },
        };
      }

      // Set active cover amount if provided (to meet RI threshold)
      if (activeCoverAmount !== null) {
        const usdcRate = mockStore.assetRates[6];
        const riThresholdInNXM = BigNumber.from(RI_THRESHOLD).mul(parseEther('1')).div(usdcRate);
        const coverAmount = riThresholdInNXM.add(activeCoverAmount);
        baseStore.covers = {
          ...(mockStore.covers || {}),
          100: {
            start: now.toNumber() - 1000,
            period: 365 * 24 * 3600,
            coverAsset: 6,
            productId: 1,
            poolAllocations: [
              {
                poolId: 1,
                coverAmountInNxm: coverAmount,
                premiumInNXM: parseEther('100'),
              },
            ],
          },
        };
      }

      return { getState: () => baseStore };
    };

    it('should return quote excluding RI when useRiVaults is false', () => {
      const productId = 1;
      const amount = parseEther('1000');
      const riStore = createRiStore(
        {
          '0x51ad1265c8702c9e96ea61fe4088c2e22ed4418e000000000000000000000000': {
            products: {
              1: { productId: 1, price: 500, weight: 25 },
            },
            vaults: ['1'],
          },
        },
        {
          '1_1': {
            vaultId: '1',
            id: '1',
            providerId: 1,
            product: 1,
            allocations: [],
            price: 500,
            activeStake: parseEther('10000'),
            withdrawalAmount: parseEther('1000'),
            asset: 0,
          },
        },
      );

      const quote = quoteEngine(riStore, productId, amount, period, 1, 0, 1, false);

      expect(quote.riQuote).to.be.null;
      expect(quote.poolsWithPremium.length).to.be.greaterThan(0);
    });

    it('should return quote with 80/20 split (default)', () => {
      const productId = 1;
      const amount = parseEther('200000');
      const riStore = createRiStore(
        {
          '0x51ad1265c8702c9e96ea61fe4088c2e22ed4418e000000000000000000000000': {
            products: {
              1: { productId: 1, price: 500, weight: 25 },
            },
            vaults: ['1'],
          },
        },
        {
          '1_1': {
            vaultId: '1',
            id: '1',
            providerId: 1,
            product: 1,
            allocations: [],
            price: 500,
            activeStake: parseEther('100000'),
            withdrawalAmount: parseEther('10000'),
            asset: 0,
          },
        },
        parseEther('1000000'), // Active cover to meet threshold
      );
      // Ensure pool capacity can take 20% of amount (~1392 NXM); 150000 allocation units = 1500 NXM per pool
      const riStoreWithPoolCap = {
        getState: () => {
          const s = riStore.getState();
          return {
            ...s,
            poolProducts: {
              ...s.poolProducts,
              '1_1': {
                ...s.poolProducts['1_1'],
                trancheCapacities: s.poolProducts['1_1'].trancheCapacities.map((_, i) =>
                  i === 7 ? BigNumber.from(150000) : BigNumber.from(0),
                ),
              },
              '1_2': {
                ...s.poolProducts['1_2'],
                trancheCapacities: s.poolProducts['1_2'].trancheCapacities.map((_, i) =>
                  i === 7 ? BigNumber.from(150000) : BigNumber.from(0),
                ),
              },
            },
          };
        },
      };

      const quote = quoteEngine(riStoreWithPoolCap, productId, amount, period, 1, 0, 1, true);

      expect(quote.riQuote).to.not.be.null;
      const amountInNXM = amount.mul(parseEther('1')).div(mockStore.assetRates[1]);
      const expectedRiAmount = amountInNXM.mul(RI_COVER_AMOUNT_PERCENTAGE).div(RI_COVER_AMOUNT_DENOMINATOR);
      const expectedPoolAmount = amountInNXM.sub(expectedRiAmount);

      // Verify RI quote has approximately 80% of the amount
      expect(quote.riQuote.amount.gte(expectedRiAmount.mul(99).div(100))).to.be.true;
      expect(quote.riQuote.amount.lte(expectedRiAmount.mul(101).div(100))).to.be.true;

      // Verify pools get the remaining amount
      const totalPoolAmount = quote.poolsWithPremium.reduce(
        (sum, pool) => sum.add(pool.coverAmountInNxm),
        BigNumber.from(0),
      );
      expect(totalPoolAmount.gte(expectedPoolAmount.mul(99).div(100))).to.be.true;
      expect(totalPoolAmount.lte(expectedPoolAmount.mul(101).div(100))).to.be.true;
    });

    it('should return quote with 100% RI coverage when product has riCoverAmountPercentage set to 100', () => {
      const productId = 1;
      const amount = parseEther('200000');
      const riStore = createRiStore(
        {
          '0x51ad1265c8702c9e96ea61fe4088c2e22ed4418e000000000000000000000000': {
            products: {
              1: { productId: 1, price: 500, weight: 25, riCoverAmountPercentage: 100 },
            },
            vaults: ['1'],
          },
        },
        {
          '1_1': {
            vaultId: '1',
            id: '1',
            providerId: 1,
            product: 1,
            allocations: [],
            price: 500,
            activeStake: parseEther('50000'),
            withdrawalAmount: parseEther('5000'),
            asset: 0,
          },
        },
        parseEther('1000000'), // Active cover to meet threshold
      );

      const quote = quoteEngine(riStore, productId, amount, period, 1, 0, 1, true);

      expect(quote.riQuote).to.not.be.null;
      const amountInNXM = amount.mul(parseEther('1')).div(mockStore.assetRates[1]);

      // Should allocate 100% to RI
      expect(quote.riQuote.amount.gte(amountInNXM.mul(99).div(100))).to.be.true;
      expect(quote.riQuote.amount.lte(amountInNXM.mul(101).div(100))).to.be.true;

      // Pools should get minimal or zero allocation
      const totalPoolAmount = quote.poolsWithPremium.reduce(
        (sum, pool) => sum.add(pool.coverAmountInNxm),
        BigNumber.from(0),
      );
      expect(totalPoolAmount.lte(amountInNXM.mul(5).div(100))).to.be.true; // Less than 5% rounding
    });

    it('should allocate remaining amount to RI when pool capacity is insufficient', () => {
      const productId = 1;
      const amount = parseEther('200000');
      const riStore = createRiStore(
        {
          '0x51ad1265c8702c9e96ea61fe4088c2e22ed4418e000000000000000000000000': {
            products: {
              1: { productId: 1, price: 500, weight: 25 },
            },
            vaults: ['1'],
          },
        },
        {
          '1_1': {
            vaultId: '1',
            id: '1',
            providerId: 1,
            product: 1,
            allocations: [],
            price: 500,
            activeStake: parseEther('1000000'), // Large RI capacity
            withdrawalAmount: parseEther('100000'),
            asset: 0,
          },
        },
        parseEther('1000000'), // Active cover to meet threshold
      );

      // Create store with limited pool capacity
      const limitedPoolStore = {
        getState: () => {
          const state = riStore.getState();
          // Reduce pool capacity significantly
          return {
            ...state,
            poolProducts: {
              ...state.poolProducts,
              '1_1': {
                ...state.poolProducts['1_1'],
                trancheCapacities: state.poolProducts['1_1'].trancheCapacities.map(() => BigNumber.from(1000)),
              },
              '1_2': {
                ...state.poolProducts['1_2'],
                trancheCapacities: state.poolProducts['1_2'].trancheCapacities.map(() => BigNumber.from(1000)),
              },
            },
          };
        },
      };

      const quote = quoteEngine(limitedPoolStore, productId, amount, period, 1, 0, 1, true);

      expect(quote.riQuote).to.not.be.null;
      const amountInNXM = amount.mul(parseEther('1')).div(mockStore.assetRates[1]);

      // RI should get more than the default 80% because pools are insufficient
      const defaultRiAmount = amountInNXM.mul(RI_COVER_AMOUNT_PERCENTAGE).div(RI_COVER_AMOUNT_DENOMINATOR);
      expect(quote.riQuote.amount.gte(defaultRiAmount)).to.be.true;
    });

    it('should allocate remaining amount to pools when RI capacity is insufficient', () => {
      const productId = 1;
      // RI capacity above min but below 80% of amount; pool capacity high so total >= amountToAllocate
      const amount = parseEther('172000'); // ~6000 NXM; 80% = 4800, we cap RI to 4000, pools get 2000
      const riStore = createRiStore(
        {
          '0x51ad1265c8702c9e96ea61fe4088c2e22ed4418e000000000000000000000000': {
            products: {
              1: { productId: 1, price: 500, weight: 25 },
            },
            vaults: ['1'],
          },
        },
        {
          '1_1': {
            vaultId: '1',
            id: '1',
            providerId: 1,
            product: 1,
            allocations: [],
            price: 500,
            // ~4000 NXM RI capacity (above min, below 80% of 6000); 3800*1.2=4560 so RI is capped below 80%
            activeStake: parseEther('3167'),
            withdrawalAmount: parseEther('633'),
            asset: 0,
          },
        },
        parseEther('1000000'), // Active cover to meet threshold
      );

      // Bump pool capacity so pools can take remainder (2000 NXM = 200000 allocation units per pool)
      const storeWithPoolCap = {
        getState: () => {
          const state = riStore.getState();
          const cap = BigNumber.from(200000);
          return {
            ...state,
            poolProducts: {
              ...state.poolProducts,
              '1_1': {
                ...state.poolProducts['1_1'],
                trancheCapacities: state.poolProducts['1_1'].trancheCapacities.map((_, i) =>
                  i === 7 ? cap : BigNumber.from(0),
                ),
              },
              '1_2': {
                ...state.poolProducts['1_2'],
                trancheCapacities: state.poolProducts['1_2'].trancheCapacities.map((_, i) =>
                  i === 7 ? cap : BigNumber.from(0),
                ),
              },
            },
          };
        },
      };

      const quote = quoteEngine(storeWithPoolCap, productId, amount, period, 1, 0, 1, true);

      expect(quote.riQuote).to.not.be.null;
      const amountInNXM = amount.mul(parseEther('1')).div(mockStore.assetRates[1]);
      const defaultRiAmount = amountInNXM.mul(RI_COVER_AMOUNT_PERCENTAGE).div(RI_COVER_AMOUNT_DENOMINATOR);

      // RI should get less than default 80% because capacity is limited
      expect(quote.riQuote.amount.lte(defaultRiAmount)).to.be.true;

      // Pools should get more than the default 20%
      const totalPoolAmount = quote.poolsWithPremium.reduce(
        (sum, pool) => sum.add(pool.coverAmountInNxm),
        BigNumber.from(0),
      );
      const defaultPoolAmount = amountInNXM.sub(defaultRiAmount);
      expect(totalPoolAmount.gte(defaultPoolAmount)).to.be.true;
    });
  });
});
