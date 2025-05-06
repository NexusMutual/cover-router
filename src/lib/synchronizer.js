const { FETCH_COVER_DATA_FROM_ID } = require('./constants');
const { calculateTrancheId, promiseAllInBatches } = require('./helpers');
const config = require('../config');
const {
  SET_ASSET_RATE,
  SET_GLOBAL_CAPACITY_RATIO,
  SET_PRODUCT,
  SET_POOL_PRODUCT,
  SET_TRANCHE_ID,
  SET_COVER,
  RESET_PRODUCT_POOLS,
} = require('../store/actions');

module.exports = async (store, chainApi, eventsApi) => {
  const updateProduct = async productId => {
    const { globalCapacityRatio } = store.getState();

    const product = await chainApi.fetchProduct(productId);
    store.dispatch({ type: SET_PRODUCT, payload: { ...product, id: productId } });

    const { capacityReductionRatio } = product;
    const poolIds = await chainApi.fetchProductPoolsIds(productId);

    store.dispatch({
      type: RESET_PRODUCT_POOLS,
      payload: { productId, poolIds },
    });

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
    console.info(`Update: product data for product with id ${productId}`);
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
    console.info(`Update: Pool data for pool with id ${poolId}`);
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

    const coverCount = await chainApi.fetchCoverCount();
    const coverIds = Array.from(
      { length: coverCount - FETCH_COVER_DATA_FROM_ID + 1 },
      (_, i) => FETCH_COVER_DATA_FROM_ID + i,
    );

    await promiseAllInBatches(coverId => updateCover(coverId), coverIds, concurrency);
  };

  const updateAssetRates = async () => {
    const { assets } = store.getState();
    const assetIds = Object.keys(assets);
    for (const assetId of assetIds) {
      const rate = await chainApi.fetchTokenPriceInAsset(assetId);
      store.dispatch({ type: SET_ASSET_RATE, payload: { assetId, rate } });
    }
    console.info('Update: Asset rates');
  };

  const updateCover = async coverId => {
    const cover = await chainApi.fetchCover(coverId);
    cover.poolAllocations = await Promise.all(
      cover.poolAllocations.map(async allocationInfo => ({
        ...allocationInfo,
        packedTrancheAllocations: await chainApi.fetchCoverPoolTrancheAllocations(
          coverId,
          allocationInfo.poolId,
          allocationInfo.allocationId,
        ),
      })),
    );

    store.dispatch({ type: SET_COVER, payload: { coverId, cover } });
    console.info(`Update: Cover data for cover id ${coverId}`);

    // todo: Q: should we fetch if we know it must be latestCoverId == coverId (id of currently edited cover)

    // fetching new reference for original cover id if this is edited cover
    if (cover.originalCoverId !== coverId) {
      const { latestCoverId } = await chainApi.fetchCoverReference(cover.originalCoverId);
      const { covers } = store.getState();
      const changedOriginalCover = {
        ...covers[cover.originalCoverId],
        latestCoverId,
      };
      store.dispatch({ type: SET_COVER, payload: { coverId: cover.originalCoverId, cover: changedOriginalCover } });
      console.info(`Update: Cover reference for original cover id ${cover.originalCoverId}`);
    }
  };

  eventsApi.on('pool:change', updatePool);
  eventsApi.on('cover:change', updateCover);
  eventsApi.on('product:change', updateProduct);
  eventsApi.on('tranche:change', updateAll);
  eventsApi.on('bucket:change', updateAll);
  eventsApi.on('block', updateAssetRates);

  return {
    updateAll,
    updateAssetRates,
    updateCover,
  };
};
