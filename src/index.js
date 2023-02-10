const { store, actions } = require('./store');
const {
  fetchStakingPoolsData,
  fetchStakingPoolDataById,
  fetchAllProductsData,
  fetchProductDataById,
} = require('./lib/contractInteraction');

async function fetchInitialData() {
  const stakingPools = await fetchStakingPoolsData();
  const products = await fetchAllProductsData();
  store.dispatch({
    type: actions.SET_STATE,
    payload: {
      products,
      stakingPools,
    },
  });
  const state = store.getState();
  console.log(state);
}

async function fetchProduct(id) {
  const productData = await fetchProductDataById(id);

  store.dispatch({
    type: actions.ADD_PRODUCT,
    payload: { id, productData },
  });
}

async function fetchStakingPoolData(id) {
  const poolData = await fetchStakingPoolDataById(id);

  store.dispatch({
    type: actions.ADD_STAKING_POOL,
    payload: { id, poolData },
  });
}
