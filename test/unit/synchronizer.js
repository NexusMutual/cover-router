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

  it('should update cover reference of original cover after editing', async () => {
    const store = createStore(initialState);
    const synchronizer = await createSynchronizer(store, mockChainApi, eventApi);

    await synchronizer.updateCover(1);
    const { covers: coversBefore } = store.getState();
    expect(coversBefore['1'].latestCoverId).to.be.equal(1);

    await synchronizer.updateCover(2);
    const { covers: coversAfter } = store.getState();
    expect(coversAfter['1'].latestCoverId).to.be.equal(2);
  });
});
