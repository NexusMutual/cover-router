const { calculateTrancheId } = require('./helpers');
const {
  SET_ASSET_RATE,
  SET_GLOBAL_CAPACITY_RATIO,
  SET_PRODUCT,
  SET_POOL_PRODUCT,
  SET_TRANCHE_ID,
} = require('../store/actions');

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
  }

  const updateAll = async () => {
    const trancheId = calculateTrancheId(Math.floor(Date.now() / 1000));
    store.dispatch({ type: SET_TRANCHE_ID, payload: trancheId });

    const globalCapacityRatio = await chainApi.fetchGlobalCapacityRatio();
    store.dispatch({ type: SET_GLOBAL_CAPACITY_RATIO, payload: globalCapacityRatio });

    const productCount = await chainApi.fetchProductCount();

    for (let productId = 0; productId < productCount; productId++) {
      await updateProduct(productId);
    }
  };

  const updateAssetRates = async () => {
    const { assets } = store.getState();
    const assetIds = Object.values(assets);
    for (const assetId of assetIds) {
      const rate = await chainApi.fetchTokenPriceInAsset(assetId);
      store.dispatch({ type: SET_ASSET_RATE, payload: { assetId, rate } });
    }
  };

  await updateAll();
  await updateAssetRates();
  console.info('All data fetched and stored');

  eventsApi.on('pool:change', updatePool);
  eventsApi.on('product:change', updateProduct);
  eventsApi.on('tranche:change', updateAll);
  eventsApi.on('block', updateAssetRates);
};
