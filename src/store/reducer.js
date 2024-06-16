const {
  SET_ASSET_RATE,
  SET_GLOBAL_CAPACITY_RATIO,
  SET_PRODUCT,
  SET_POOL_PRODUCT,
  SET_TRANCHE_ID,
  RESET_PRODUCT_POOLS,
} = require('./actions');

const initialState = {
  assetRates: {}, // assetId -> rate
  assets: {
    0: { id: 0, symbol: 'ETH', decimals: 18 },
    1: { id: 1, symbol: 'DAI', decimals: 18 },
    6: { id: 6, symbol: 'USDC', decimals: 6 },
    255: { id: 255, symbol: 'NXM', decimals: 18 },
  },
  globalCapacityRatio: 0,
  poolProducts: {}, // {productId}_{poolId} -> { allocations, trancheCapacities }
  productPoolIds: {}, // productId -> [ poolIds ]
  products: {}, // productId -> { product }
  productPriorityPoolsFixedPrice: {
    // NOTE: only fixed price products are currently supported
    186: [18, 22, 1],
  },
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

  if (type === RESET_PRODUCT_POOLS) {
    const { productId, poolIds } = payload;
    const oldProductPoolIds = state.productPoolIds[productId] || [];
    const poolProducts = { ...state.poolProducts };

    const poolIdsSet = new Set(poolIds);
    const poolIdsToRemove = oldProductPoolIds.filter(poolId => !poolIdsSet.has(poolId));

    for (const poolId of poolIdsToRemove) {
      delete poolProducts[`${productId}_${poolId}`];
    }

    const productPoolIds = { ...state.productPoolIds, [productId]: poolIds };
    return { ...state, productPoolIds, poolProducts };
  }

  return state;
}

module.exports = {
  initialState,
  reducer,
};
