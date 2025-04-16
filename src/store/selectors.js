const selectAssetRate = (store, assetId) => {
  const { assetRates } = store.getState();
  return assetRates[assetId];
};

const selectAsset = (store, assetId) => {
  const { assets } = store.getState();
  return assets[assetId];
};

const selectCover = (store, coverId) => {
  const { covers } = store.getState();
  return covers[coverId];
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

const selectProductPriorityPoolsFixedPrice = (store, productId) => {
  const { productPriorityPoolsFixedPrice } = store.getState();
  return productPriorityPoolsFixedPrice[productId];
};

/**
 * Retrieves all product IDs that are associated with a specific pool.
 *
 * @param {Object} store - The Redux store containing application state.
 * @param {number|string} poolId - The ID of the pool to filter products by.
 * @returns {Array<string>} An array of product IDs associated with the specified pool.
 */
function selectProductsInPool(store, poolId) {
  const { products } = store.getState();
  return Object.keys(products).filter(productId => {
    const productPools = selectProductPools(store, productId, poolId);
    return productPools?.length > 0;
  });
}

module.exports = {
  selectAssetRate,
  selectAsset,
  selectCover,
  selectProduct,
  selectProductPools,
  selectProductPriorityPoolsFixedPrice,
  selectProductsInPool,
};
