const config = require('../config');
const { calculateTrancheId, promiseAllInBatches } = require('./helpers');
const {
  SET_ASSET_RATE,
  SET_GLOBAL_CAPACITY_RATIO,
  SET_PRODUCT,
  SET_POOL_PRODUCT,
  SET_TRANCHE_ID,
  SET_COVER
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
    console.log(`Update: product data for product with id ${productId}`);
  };

  const updateCover = async coverId => {

    const product = await chainApi.fetchCover(coverId);
    store.dispatch({ type: SET_COVER, payload: { ...product, id: coverId } });

    console.log(`Update: cover data for cover with id ${coverId}`);
  };

  const updateCovers = async () => {

    const coverCount = await chainApi.fetchCoverCount();

    const coverIds = [];

    for (let i = 0; i < coverCount.toNumber(); i++) {
      coverIds.push(i);
    }

    const covers = chainApi.fetchCovers(coverIds);

    for (let i = 0; i < covers.length; i++) {
      store.dispatch({ type: SET_COVER, payload: { ...covers[i], id: coverIds[i] } });
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
    console.log(`Update: Pool data for pool with id ${poolId}`);
  }

  const updateAll = async () => {
    const trancheId = calculateTrancheId(Math.floor(Date.now() / 1000));
    store.dispatch({ type: SET_TRANCHE_ID, payload: trancheId });

    const globalCapacityRatio = await chainApi.fetchGlobalCapacityRatio();
    store.dispatch({ type: SET_GLOBAL_CAPACITY_RATIO, payload: globalCapacityRatio });

    await updateCovers();

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
    console.log('Update: Asset rates');
  };

  await updateAll();
  await updateAssetRates();
  console.log('All data fetched and stored');

  eventsApi.on('pool:change', updatePool);
  eventsApi.on('product:change', updateProduct);
  eventsApi.on('cover:change', updateCover);
  eventsApi.on('tranche:change', updateAll);
  eventsApi.on('bucket:change', updateAll);
  eventsApi.on('block', updateAssetRates);
};
