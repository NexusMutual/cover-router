const { actions } = require('../store');
const initializeChainAPI = require('./chainAPI.js');
const { calculateCurrentTrancheId } = require('./helpers');

module.exports = function (store, provider) {
  const chainAPI = initializeChainAPI(provider);

  async function _fetchAllData() {
    const trancheId = calculateCurrentTrancheId();
    const globalCapacityRatio = await chainAPI.fetchGlobalCapacityRatio();
    const poolsCount = await chainAPI.fetchStakingPoolCount();
    const products = await chainAPI.fetchProducts();
    const stakingPools = {};

    for (const productId in products) {
      stakingPools[productId] = {};
      const poolIds = await chainAPI.fetchProductPools(productId);
      for (const poolId of poolIds) {
        stakingPools[productId][poolId] = await chainAPI.fetchProductDataForPool(
          productId,
          poolId,
          products[productId].capacityReductionRatio,
          globalCapacityRatio,
        );
      }
    }

    store.dispatch({
      type: actions.SET_STATE,
      payload: {
        trancheId,
        globalCapacityRatio,
        poolsCount,
        products,
        stakingPools,
      },
    });

    console.info('All data fetched and preserved');
  }

  async function _updateProduct(productId) {
    const { stakingPools, globalCapacityRatio, products } = store.getState();
    let poolIds;

    if (productId < products.length) {
      poolIds = Object.keys(stakingPools[productId]);
    } else {
      poolIds = await chainAPI.fetchProductPools(productId);
    }

    const productPools = {};
    const product = await chainAPI.fetchProduct(productId);
    for (const poolId of poolIds) {
      productPools[poolId] = await chainAPI.fetchProductDataForPool(
        productId,
        poolId,
        product.capacityReductionRatio,
        globalCapacityRatio,
      );
    }

    store.dispatch({
      type: actions.SET_PRODUCT,
      payload: { ...product, id: productId },
    });
    store.dispatch({
      type: actions.SET_ALL_PRODUCT_STAKING_POOLS,
      payload: {
        productId,
        productPools,
      },
    });
  }

  async function _updatePool(poolId) {
    const { stakingPools, globalCapacityRatio, products, stakingPoolCount } = store.getState();
    let stakingPoolProducts;

    if (poolId > stakingPoolCount) {
      stakingPoolProducts = await chainAPI.fetchPoolsProducts(poolId);
    } else {
      stakingPoolProducts = Object.entries(stakingPools).reduce((acc, [productId, stakingPools = []]) => {
        if (Object.keys(stakingPools).includes(poolId)) {
          acc.push(productId);
        }
        return acc;
      }, []);
    }

    for (const productId of stakingPoolProducts) {
      const stakingPoolData = await chainAPI.fetchProductDataForPool(
        productId,
        poolId,
        products[productId].capacityReductionRatio,
        globalCapacityRatio,
      );

      store.dispatch({
        type: actions.SET_PRODUCT_STAKING_POOL,
        payload: {
          productId,
          poolId,
          stakingPoolData,
        },
      });
    }
  }

  async function _updateTrancheId(trancheId) {
    const { products } = store.getState();
    for (let productId = 0; productId < products.length; productId++) {
      await _updateProduct(productId);
    }
    store.dispatch({
      type: actions.SET_TRANCHE_ID,
      payload: trancheId,
    });
  }

  async function initialize() {
    await _fetchAllData();

    const chainListener = chainAPI.initiateListener();

    chainListener.on('pool:change', _updatePool);
    chainListener.on('product:change', _updateProduct);
    chainListener.on('tranche:change', _updateTrancheId);
  }

  return {
    initialize,
    chainAPI,
  };
};
