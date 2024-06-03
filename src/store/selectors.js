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

const selectAsset = (store, assetId) => {
  const { assets } = store.getState();
  return assets[assetId];
};

module.exports = {
  selectAssetRate,
  selectAsset,
  selectProduct,
  selectProductPools,
};
