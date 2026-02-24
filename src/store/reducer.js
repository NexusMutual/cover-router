const {
  SET_ASSET_RATE,
  SET_GLOBAL_CAPACITY_RATIO,
  SET_PRODUCT,
  SET_POOL_PRODUCT,
  SET_TRANCHE_ID,
  SET_COVER,
  SET_COVER_REFERENCE,
  RESET_PRODUCT_POOLS,
  SET_RI_ASSET_RATE,
  SET_RI_VAULT_PRODUCT,
  SET_RI_VAULT_PRODUCTS,
  SET_RI_EPOCH_EXPIRIES,
  SET_VAULT_STAKE,
  SET_RI_NONCE,
} = require('./actions');
const riSubnetworks = require('./riSubnetworks.json');
const config = require('../config');

// Automatically populate productPriorityPoolsFixedPrice
const customPriorityPoolsOrder = config.get('customPriorityPoolsOrder') || {};
const productPriorityPoolsFixedPrice = {};

for (const [productId, orderArray] of Object.entries(customPriorityPoolsOrder)) {
  productPriorityPoolsFixedPrice[productId] = orderArray;
}

const initialState = {
  riSubnetworks,
  assetRates: {}, // assetId -> rate
  assets: {
    0: { id: 0, symbol: 'ETH', decimals: 18 },
    1: { id: 1, symbol: 'DAI', decimals: 18 },
    6: { id: 6, symbol: 'USDC', decimals: 6 },
    7: { id: 7, symbol: 'cbBTC', decimals: 8 },
    255: { id: 255, symbol: 'NXM', decimals: 18 },
  },
  riAssetRates: {}, // assetId -> rate
  riAssets: {
    0: { id: 0, symbol: 'wstETH', decimals: 18 },
  },
  globalCapacityRatio: 0,
  poolProducts: {}, // {productId}_{poolId} -> { allocations, trancheCapacities }
  productPoolIds: {}, // productId -> [ poolIds ]
  products: {}, // productId -> { product }
  covers: {}, // coverId -> { cover }
  productPriorityPoolsFixedPrice,
  trancheId: 0,
  vaultProducts: {}, // {productId}_{vaultId} -> { allocations, activeStake, withdrawalAmount, price }
  epochExpires: {}, // vaultId -> timestamp
  riNonces: {},
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

  if (type === SET_COVER) {
    const { coverId, cover } = payload;
    const covers = { ...state.covers, [coverId]: cover };
    return { ...state, covers };
  }

  if (type === SET_COVER_REFERENCE) {
    const { coverId, originalCoverId, latestCoverId } = payload;
    const covers = { ...state.covers, [coverId]: { ...state.covers[coverId], originalCoverId, latestCoverId } };
    return { ...state, covers };
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

  if (type === SET_RI_ASSET_RATE) {
    const { assetId, rate } = payload;
    const riAssetRates = { ...state.riAssetRates, [assetId]: rate };
    return { ...state, riAssetRates };
  }

  if (type === SET_RI_VAULT_PRODUCT) {
    const { vaultProductId, allocations } = payload;
    const vaultProduct = state.vaultProducts[vaultProductId];
    const vaultProducts = { ...state.vaultProducts, [vaultProductId]: { ...vaultProduct, allocations } };
    return { ...state, vaultProducts };
  }

  if (type === SET_VAULT_STAKE) {
    const { vaultId, productIds, productStakes, withdrawalAmount } = payload;
    const newVaultProducts = {};
    for (const productId of productIds) {
      const key = `${productId}_${vaultId}`;
      newVaultProducts[key] = {
        ...state.vaultProducts[key],
        activeStake: productStakes[productId],
        withdrawalAmount,
      };
    }
    const vaultProducts = { ...state.vaultProducts, ...newVaultProducts };
    return { ...state, vaultProducts };
  }

  if (type === SET_RI_EPOCH_EXPIRIES) {
    const { expiries } = payload;

    return { ...state, epochExpires: { ...state.epochExpires, ...expiries } };
  }

  if (type === SET_RI_VAULT_PRODUCTS) {
    const { vaultProducts } = payload;
    return { ...state, vaultProducts: { ...state.vaultProducts, ...vaultProducts } };
  }

  if (type === SET_RI_NONCE) {
    const { providerId, nonce } = payload;
    return { ...state, riNonces: { ...state.riNonces, [providerId]: nonce } };
  }

  return state;
}

module.exports = {
  initialState,
  reducer,
};
