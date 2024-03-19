const {
  SET_ASSET_RATE,
  SET_GLOBAL_CAPACITY_RATIO,
  SET_PRODUCT,
  SET_POOL_PRODUCT,
  SET_TRANCHE_ID,
} = require('./actions');

const initialState = {
  assetRates: {}, // assetId -> rate
  assets: { ETH: 0, DAI: 1, NXM: 255 },
  globalCapacityRatio: 0,
  poolProducts: {}, // {productId}_{poolId} -> { allocations, trancheCapacities }
  productPoolIds: {}, // productId -> [ poolIds ]
  products: {}, // productId -> { product }
  trancheId: 0,
};

function reducer(state = initialState, { type, payload }) {
  if (type === SET_PRODUCT) {
    const product = { ...payload };
    const products = { ...state.products, [product.id]: product };
    return { ...state, products };
  }

  // TODO: handle product removal
  if (type === SET_POOL_PRODUCT) {
    const { productId, poolId, poolProduct } = payload;
    const key = `${productId}_${poolId}`;
    const newPoolProduct = { productId, poolId, ...poolProduct };
    const poolProducts = { ...state.poolProducts, [key]: newPoolProduct };
    const previousIds = state.productPoolIds[productId] || [];
    const newIds = [...new Set([...previousIds, poolId])];
    const productPoolIds = { ...state.productPoolIds, [productId]: newIds };
    return { ...state, poolProducts, productPoolIds };
  }

  if (type === SET_ASSET_RATE) {
    const { assetId, rate } = payload;
    const assetRates = { ...state.assetRates, [assetId]: rate };
    return { ...state, assetRates };
  }

  if (type === SET_GLOBAL_CAPACITY_RATIO) {
    return { ...state, globalCapacityRatio: payload };
  }

  if (type === SET_TRANCHE_ID) {
    return { ...state, trancheId: payload };
  }

  return state;
}

module.exports = {
  initialState,
  reducer,
};
