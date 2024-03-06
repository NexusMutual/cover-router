const selectAssetRate = (store, assetId) => {
  const { assetRates } = store.getState();
  return assetRates[assetId];
};

const selectProduct = (store, productId) => {
  const { products } = store.getState();
  return products[productId];
};

const selectCover = (store, productId) => {
  const { covers } = store.getState();
  return covers[productId];
};

const selectProductPools = (store, productId) => {
  const { poolProducts, productPoolIds } = store.getState();
  const poolIds = productPoolIds[productId] || [];
  return poolIds.map(poolId => {
    const key = `${productId}_${poolId}`;
    return poolProducts[key];
  });
};

const selectAssetSymbol = (store, assetId) => {
  const { assets } = store.getState();
  return Object.keys(assets).find(key => assets[key] === assetId);
};

module.exports = {
  selectAssetRate,
  selectAssetSymbol,
  selectProduct,
  selectProductPools,
  selectCover
};
