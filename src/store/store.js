const { createStore } = require('redux');
const actions = require('./actions');

const initialState = {
  trancheId: 0,
  globalCapacityRatio: 0,
  stakingPoolCount: 0,
  products: {},
  stakingPools: {},
  assetId: {
    ETH: 0,
    DAI: 1,
  },
};

function reducer(state = initialState, { type, payload }) {
  if (type === actions.SET_STATE) {
    return { ...state, ...payload };
  }

  if (type === actions.SET_PRODUCTS) {
    return {
      ...state,
      products: { ...payload },
    };
  }

  if (type === actions.SET_PRODUCT) {
    return {
      ...state,
      products: {
        ...state.products,
        [payload.id]: { ...payload.productData },
      },
    };
  }

  if (type === actions.SET_PRODUCT_STAKING_POOL) {
    const { productId, poolId, productPool } = payload;
    return {
      ...state,
      stakingPools: {
        ...state.stakingPools,
        [productId]: {
          ...state.stakingPools[productId],
          [poolId]: productPool,
        },
      },
    };
  }

  if (type === actions.SET_ALL_PRODUCT_STAKING_POOLS) {
    const { productId, productPools } = payload;
    return {
      ...state,
      stakingPools: {
        ...state.stakingPools,
        [productId]: productPools,
      },
    };
  }

  if (type === actions.REMOVE_PRODUCT) {
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
  }

  if (type === actions.SET_TRANCHE_ID) {
    return {
      ...state,
      trancheId: payload,
    };
  }

  return state;
}

module.exports = () => createStore(reducer);
