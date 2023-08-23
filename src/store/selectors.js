const selectAssetRate = (store, assetId) => {
  const { assetRates } = store.getState();
  return assetRates[assetId];
};

const selectProduct = (store, productId) => {
  const { products } = store.getState();
  return products[productId];
};

const selectProductPools = (store, productId) => {
  const { poolProducts } = store.getState();
  return Object.values(poolProducts).filter(item => `${item.productId}` === `${productId}`);
};

const selectPoolProducts = (store, poolId) => {
  const { poolProducts } = store.getState();
  return Object.values(poolProducts).filter(item => `${item.poolId}` === `${poolId}`);
};

const selectPoolIds = store => {
  const { poolProducts } = store.getState();
  return Object.values(poolProducts).reduce((acc, item) => {
    if (!acc.includes(`${item.poolId}`)) {
      acc.push(`${item.poolId}`);
    }
    return acc;
  }, []);
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
  selectPoolProducts,
  selectPoolIds,
};
