const { ethers } = require('ethers');
const { actions } = require('../store');
const config = require('../config');
const contractsFetcher = require('./contracts.js');
const { calculateCurrentTrancheId } = require('./helpers');

const url = config.get('provider.ws');
const provider = new ethers.providers.WebSocketProvider(url);

module.exports = async function (store) {
  const contracts = contractsFetcher(provider);

  async function _updateProduct(productId) {
    const { stakingPools, globalCapacityRatio, products } = store.getState();
    let poolIds;

    if (productId < products.length) {
      poolIds = Object.keys(stakingPools[productId]);
    } else {
      poolIds = await contracts.fetchProductPools(productId);
    }

    const productPools = {};
    const product = await contracts.fetchProduct(productId);
    for (const poolId of poolIds) {
      productPools[poolId] = await contracts.fetchProductDataForPool(
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
  async function _updateProductsByStakingPool(poolId) {
    const { stakingPools, globalCapacityRatio, products, stakingPoolCount } = store.getState();
    let stakingPoolProducts;

    if (poolId > stakingPoolCount) {
      stakingPoolProducts = await contracts.fetchPoolsProducts(poolId);
    } else {
      stakingPoolProducts = Object.entries(stakingPools).reduce((acc, [productId, stakingPools = []]) => {
        if (Object.keys(stakingPools).includes(poolId)) {
          acc.push(productId);
        }
        return acc;
      }, []);
    }

    for (const productId of stakingPoolProducts) {
      const stakingPoolData = await contracts.fetchProductDataForPool(
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

  async function fetchAllData() {
    const trancheId = calculateCurrentTrancheId();
    const globalCapacityRatio = await contracts.fetchGlobalCapacityRatio();
    const poolsCount = await contracts.fetchStakingPoolCount();
    const products = await contracts.fetchProducts();
    const stakingPools = {};

    for (const productId in products) {
      stakingPools[productId] = {};
      const poolIds = await contracts.fetchProductPools(productId);
      for (const poolId of poolIds) {
        stakingPools[productId][poolId] = await contracts.fetchProductDataForPool(
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

  async function trancheCheck() {
    const { trancheId, products } = store.getState();
    const activeTrancheId = calculateCurrentTrancheId();
    if (activeTrancheId !== trancheId) {
      for (let productId = 0; productId < products.length; productId++) {
        await _updateProduct(productId);
      }
      store.dispatch({
        type: actions.SET_TRANCHE_ID,
        payload: activeTrancheId,
      });
    }
    setTimeout(trancheCheck, 1000);
  }

  // subscribe to Pool events
  function subscribeToStakingPoolEvents() {
    const { stakingPoolCount } = store.getState();
    contracts.subscribeToAllStakingPoolDependantEvents(stakingPoolCount, _updateProductsByStakingPool);
  }

  function subscribeToNewStakingPools() {
    contracts.subscribeToNewStakingPools(_updateProductsByStakingPool);
  }

  // subscribe to Cover Events
  function subscribeToCoverEvents() {
    contracts.subscribeToCoverEvents(_updateProduct);
  }

  return {
    fetchAllData,
    trancheCheck,
    subscribeToNewStakingPools,
    subscribeToStakingPoolEvents,
    subscribeToCoverEvents,
  };
};
