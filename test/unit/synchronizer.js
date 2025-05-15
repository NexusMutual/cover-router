const EventEmitter = require('events');

const { expect } = require('chai');
const { BigNumber } = require('ethers');

const createSynchronizer = require('../../src/lib/synchronizer');
const { createStore, initialState } = require('../../src/store');
const mockChainApi = require('../mocks/chainApi');
const mockStore = require('../mocks/store');

const extendedMockStore = {
  ...mockStore,
  productPoolIds: { ...mockStore.productPoolIds, 1: [1, 2, 3] },
  poolProducts: {
    ...mockStore.poolProducts,
    '1_3': {
      productId: 0,
      poolId: 2,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(36480),
      ],
      trancheCapacities: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(36480),
      ],
      lastEffectiveWeight: BigNumber.from(0),
      targetWeight: BigNumber.from(40),
      targetPrice: BigNumber.from(200),
      bumpedPrice: BigNumber.from(100),
      bumpedPriceUpdateTime: BigNumber.from(1678700055),
    },
  },
};

describe('synchronizer', () => {
  const eventApi = new EventEmitter();

  it('should remove old data and add new one', async () => {
    const store = createStore(extendedMockStore);
    const synchronizer = await createSynchronizer(store, mockChainApi, eventApi);
    await synchronizer.updateAll();

    const state = store.getState();

    expect(state.productPoolIds[1]).to.not.include(3);
    expect(state.poolProducts['1_3']).to.be.equal(undefined);
  });

  it('update the store with new data', async () => {
    const store = createStore(initialState);
    const synchronizer = await createSynchronizer(store, mockChainApi, eventApi);
    await synchronizer.updateAll();
    await synchronizer.updateAssetRates();

    const state = store.getState();
    expect(state.assets).to.be.deep.equal(mockStore.assets);
    expect(state.assetRates).to.be.deep.equal(mockStore.assetRates);
    expect(state.products).to.be.deep.equal(mockStore.products);
    expect(state.productPoolIds).to.be.deep.equal(mockStore.productPoolIds);
    expect(state.globalCapacityRatio).to.be.deep.equal(mockStore.globalCapacityRatio);
    expect(state.poolProducts).to.be.deep.equal(mockStore.poolProducts);
  });

  it('should update cover reference on updateCover and updateCoverReference', async () => {
    const store = createStore(initialState);
    const synchronizer = await createSynchronizer(store, mockChainApi, eventApi);

    await synchronizer.updateCover(1);
    const cover1BeforeEdit = store.getState().covers['1'];
    expect(cover1BeforeEdit.originalCoverId).to.be.equal(1);
    expect(cover1BeforeEdit.latestCoverId).to.be.equal(1);

    await synchronizer.updateCover(2);
    const cover2 = store.getState().covers['2'];
    expect(cover2.originalCoverId).to.be.equal(1);
    expect(cover2.latestCoverId).to.be.equal(2);

    await synchronizer.updateCoverReference(1);
    const cover1AfterEdit = store.getState().covers['1'];
    expect(cover1AfterEdit.originalCoverId).to.be.equal(1);
    expect(cover1AfterEdit.latestCoverId).to.be.equal(2);
  });
});
