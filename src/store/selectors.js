const selectAssetRate = (store, assetId) => {
  const { assetRates } = store.getState();
  return assetRates[assetId];
};

const selectProduct = (store, productId) => {
  const { products } = store.getState();
  return products[productId];
};

const selectProductPools = (store, productId) => {
  const { poolProducts, productPoolIds } = store.getState();
  const poolIds = productPoolIds[productId] || [];
  return poolIds.map(poolId => {
    const key = `${productId}_${poolId}`;
    return poolProducts[key];
  });
};

const selectAssetInfo = (store, assetId) => {
  const { assets } = store.getState();
  const { id, symbol, decimals } = assets[assetId];
  return { id, symbol, decimals };
};

module.exports = {
  selectAssetRate,
  selectAssetInfo,
  selectProduct,
  selectProductPools,
};
