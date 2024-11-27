const selectAssetRate = (store, assetId) => {
  const { assetRates } = store.getState();
  return assetRates[assetId];
};

const selectProduct = (store, productId) => {
  const { products } = store.getState();
  return products[productId];
};

/**
 * Retrieves the product pools associated with a specific product ID, optionally filtered by a pool ID.
 *
 * @param {Object} store - The Redux store containing the application state.
 * @param {number} productId - The ID of the product for which to retrieve pools.
 * @param {number|null} [poolId=null] - The ID of the pool to filter by.
 *                                      If not provided, all pools associated with the product are returned.
 * @returns {Array<Object>} Array of product pool objects associated with the specified product (and pool, if provided).
 */
const selectProductPools = (store, productId, poolId = null) => {
  const { poolProducts, productPoolIds } = store.getState();
  const poolIds = productPoolIds[productId] || [];

  if (poolId !== null && poolId !== undefined) {
    const key = `${productId}_${poolId}`;
    return poolIds.includes(Number(poolId)) ? [poolProducts[key]] : [];
  }

  // List of product data across all pools
  return poolIds.map(id => poolProducts[`${productId}_${id}`]);
};

const selectAsset = (store, assetId) => {
  const { assets } = store.getState();
  return assets[assetId];
};

const selectProductPriorityPoolsFixedPrice = (store, productId) => {
  const { productPriorityPoolsFixedPrice } = store.getState();
  return productPriorityPoolsFixedPrice[productId];
};

module.exports = {
  selectAssetRate,
  selectAsset,
  selectProduct,
  selectProductPools,
  selectProductPriorityPoolsFixedPrice,
};
