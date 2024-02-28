const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const config = require('../config');
const { calculateTrancheId, promiseAllInBatches } = require('./helpers');
const {
  SET_ASSET_RATE,
  SET_GLOBAL_CAPACITY_RATIO,
  SET_PRODUCT,
  SET_POOL_PRODUCT,
  SET_TRANCHE_ID,
  SET_STATE,
} = require('../store/actions');

const { BigNumber } = ethers;

const STATE_FILE = path.resolve(__dirname, '../../storage', 'state.json');

const parseJsonBigNumbers = state => {
  if (state.type === 'BigNumber') {
    return BigNumber.from(state);
  }

  const parsedState = {};
  Object.entries(state).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      parsedState[key] = value.map(item => (typeof item === 'object' ? parseJsonBigNumbers(item) : item));
    } else if (typeof value === 'object') {
      parsedState[key] = parseJsonBigNumbers(value);
    } else {
      parsedState[key] = value;
    }
  });

  return parsedState;
};

module.exports = async (store, chainApi, eventsApi) => {
  const updateProduct = async productId => {
    const { globalCapacityRatio } = store.getState();

    const product = await chainApi.fetchProduct(productId);
    store.dispatch({ type: SET_PRODUCT, payload: { ...product, id: productId } });

    const { capacityReductionRatio } = product;
    const poolIds = await chainApi.fetchProductPoolsIds(productId);

    for (const poolId of poolIds) {
      const poolProduct = await chainApi.fetchPoolProduct(
        productId,
        poolId,
        globalCapacityRatio,
        capacityReductionRatio,
      );
      store.dispatch({
        type: SET_POOL_PRODUCT,
        payload: { productId, poolId, poolProduct },
      });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(store.getState(), null, 2));
    console.log(`Update: product data for product with id ${productId}`);
  };

  async function updatePool(poolId) {
    const { globalCapacityRatio, products } = store.getState();
    const productIds = await chainApi.fetchPoolProductIds(poolId);
    for (const productId of productIds) {
      const poolProduct = await chainApi.fetchPoolProduct(
        productId,
        poolId,
        globalCapacityRatio,
        products[productId].capacityReductionRatio,
      );
      store.dispatch({
        type: SET_POOL_PRODUCT,
        payload: { productId, poolId, poolProduct },
      });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(store.getState(), null, 2));
    console.log(`Update: Pool data for pool with id ${poolId}`);
  }

  const updateAll = async () => {
    const trancheId = calculateTrancheId(Math.floor(Date.now() / 1000));
    store.dispatch({ type: SET_TRANCHE_ID, payload: trancheId });

    const globalCapacityRatio = await chainApi.fetchGlobalCapacityRatio();
    store.dispatch({ type: SET_GLOBAL_CAPACITY_RATIO, payload: globalCapacityRatio });

    const productCount = await chainApi.fetchProductCount();

    const productIds = Array.from({ length: productCount }, (_, i) => i);
    const concurrency = config.get('concurrency');

    await promiseAllInBatches(productId => updateProduct(productId), productIds, concurrency);
  };

  const updateAssetRates = async () => {
    const { assets } = store.getState();
    const assetIds = Object.values(assets);
    for (const assetId of assetIds) {
      const rate = await chainApi.fetchTokenPriceInAsset(assetId);
      store.dispatch({ type: SET_ASSET_RATE, payload: { assetId, rate } });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(store.getState(), null, 2));
    console.log('Update: Asset rates');
  };

  const persistStatePath = path.resolve(__dirname, '../../storage', STATE_FILE);

  if (fs.existsSync(persistStatePath)) {
    const state = JSON.parse(fs.readFileSync(persistStatePath, 'utf8'));
    console.log('Restoring state from file');
    store.dispatch({ type: SET_STATE, payload: parseJsonBigNumbers(state) });

    Promise.resolve()
      .then(() => updateAssetRates())
      .catch(err => console.error('Error while running updateAssetRates:', err))
      .then(() => updateAll())
      .catch(err => console.error('Error while running updatingAll', err));
  } else {
    await updateAll();
    await updateAssetRates();
    console.log('All data fetched and stored');
  }

  eventsApi.on('pool:change', updatePool);
  eventsApi.on('product:change', updateProduct);
  eventsApi.on('tranche:change', updateAll);
  eventsApi.on('bucket:change', updateAll);
  eventsApi.on('block', updateAssetRates);

  return {
    updateAll,
    updateAssetRates,
  };
};
