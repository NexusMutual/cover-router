const { createStore } = require('redux');
const actions = require('./actions');

const initialState = {
  products: {},
  stakingPools: {},
};
function reducer(state = initialState, { type, payload }) {
  if (type === actions.SET_STATE) {
    return payload;
  } else if (type === actions.SET_PRODUCTS) {
    return {
      ...state,
      products: { ...payload },
    };
  } else if (type === actions.SET_STAKING_POOLS) {
    return {
      ...state,
      stakingPools: { ...payload },
    };
  } else if (type === actions.ADD_PRODUCT) {
    return {
      ...state,
      products: {
        ...state.products,
        [payload.id]: { ...payload.productData },
      },
    };
  } else if (type === actions.SET_PRODUCT_STAKING_POOL) {
    const { productId, poolId, stakingPoolData } = payload;
    return {
      ...state,
      products: {
        ...state.products,
        [productId]: {
          ...state.products[productId],
          [poolId]: stakingPoolData,
        },
      },
    };
  } else if (type === actions.REMOVE_PRODUCT) {
    const products = Object.values(state.products).reduce((acc, [key, value]) => {
      if (payload.id !== key) {
        acc[key] = value;
      }
      return acc;
    }, {});
    return {
      ...state,
      products,
    };
  } else if (type === actions.ADD_STAKING_POOL) {
    return {
      ...state,
      stakingPools: {
        ...state.stakingPools,
        [payload.id]: { ...payload.poolData },
      },
    };
  } else if (type === actions.REMOVE_STAKING_POOL) {
    const stakingPools = Object.values(state.products).reduce((acc, [key, value]) => {
      if (payload.id !== key) {
        acc[key] = value;
      }
      return acc;
    }, {});
    return {
      ...state,
      stakingPools,
    };
  } else if (type === actions.UPDATE_LAST_BLOCK_CHECKED) {
    return {
      ...state,
      lastBlockChecked: payload,
    };
  } else {
    return state;
  }
}
const store = createStore(reducer);

module.exports = store;
