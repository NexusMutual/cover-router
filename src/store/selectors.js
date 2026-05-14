const { BigNumber } = require('ethers');

/**
 * @typedef {import('./reducer').Store} Store
 * @typedef {import('./reducer').StoreState} StoreState
 * @typedef {import('./reducer').Asset} Asset
 * @typedef {import('./reducer').Product} Product
 * @typedef {import('./reducer').PoolProduct} PoolProduct
 * @typedef {import('./reducer').Cover} Cover
 * @typedef {import('./reducer').VaultProduct} VaultProduct
 */

/**
 * @param {Store} store
 * @param {number|string} assetId
 * @returns {BigNumber|undefined}
 */
const selectAssetRate = (store, assetId) => {
  const { assetRates } = store.getState();
  return assetRates[assetId];
};

/**
 * @param {Store} store
 * @param {number|string} assetId
 * @returns {Asset|undefined}
 */
const selectAsset = (store, assetId) => {
  const { assets } = store.getState();
  return assets[assetId];
};

/**
 * @param {Store} store
 * @param {number|string} coverId
 * @returns {Cover|undefined}
 */
const selectCover = (store, coverId) => {
  const { covers } = store.getState();
  return covers[coverId];
};

/**
 * @param {Store} store
 * @param {number|string} productId
 * @returns {Product|undefined}
 */
const selectProduct = (store, productId) => {
  const { products } = store.getState();
  return products[productId];
};

/**
 * Retrieves the product pools associated with a specific product ID, optionally filtered by a pool ID.
 *
 * @param {Store} store
 * @param {number|string} productId
 * @param {number|null} [poolId=null] - When set, returns only the matching pool entry.
 * @returns {PoolProduct[]}
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

/**
 * Retrieves all product IDs that are associated with a specific pool.
 *
 * @param {Store} store
 * @param {number|string} poolId
 * @returns {string[]} Product ID strings (object keys from `products`).
 */
function selectProductsInPool(store, poolId) {
  const { products } = store.getState();
  return Object.keys(products).filter(productId => {
    const productPools = selectProductPools(store, productId, poolId);
    return productPools?.length > 0;
  });
}

/**
 * Sum of `coverAmountInNXM` across all active covers for a product.
 *
 * @param {Store} store
 * @param {number} productId
 * @param {number} now - Current unix timestamp in seconds.
 * @returns {BigNumber}
 */
const selectActiveCoverAmount = (store, productId, now) => {
  const { covers } = store.getState();
  return Object.values(covers).reduce((acc, cover) => {
    const isStillActive = now < cover.start + cover.period;

    if (isStillActive && cover.productId === productId) {
      for (const pool of cover.poolAllocations) {
        const rawCoverAmount = pool.coverAmountInNXM ?? pool.coverAmountInNxm ?? 0;
        const coverAmount = BigNumber.from(rawCoverAmount);
        acc = acc.add(coverAmount);
      }
    }
    return acc;
  }, BigNumber.from(0));
};

/**
 * @param {Store} store
 * @param {number|string} assetId
 * @returns {BigNumber|undefined}
 */
const selectRiAssetRate = (store, assetId) => {
  const { riAssetRates } = store.getState();
  return riAssetRates[assetId];
};

/**
 * Collects vault product rows for a given product across all riSubnetworks.
 *
 * @param {Store} store
 * @param {number|string} productId
 * @returns {VaultProduct[]}
 */
const selectProductVaults = (store, productId) => {
  const { riSubnetworks = {}, vaultProducts = {} } = store.getState();

  const vaultsIdsSet = new Set();
  for (const subnetwork of Object.values(riSubnetworks)) {
    const vaults = subnetwork.vaults;
    if (Object.keys(subnetwork.products).includes(String(productId))) {
      vaults.forEach(vaultId => vaultsIdsSet.add(vaultId));
    }
  }
  const vaultsIds = Array.from(vaultsIdsSet);

  return vaultsIds.map(vaultId => vaultProducts[`${productId}_${vaultId}`]).filter(Boolean);
};

/**
 * @param {Store} store
 * @returns {Object<string, number>} vaultId -> epoch expiry timestamp.
 */
const selectVaultEpochExpiryTimestamp = store => {
  const { epochExpires = {} } = store.getState();
  return epochExpires;
};

/**
 * Gets the RI cover amount percentage for a product from riSubnetworks.
 * Returns the percentage from the first subnetwork that contains the product,
 * or null if not found (will default to RI_COVER_AMOUNT_PERCENTAGE constant).
 *
 * @param {Store} store
 * @param {number|string} productId
 * @returns {number|null} The RI cover amount percentage (0-100) or null if not found.
 */
const selectRiCoverAmountPercentage = (store, productId) => {
  const { riSubnetworks = {} } = store.getState();

  for (const subnetwork of Object.values(riSubnetworks)) {
    if (subnetwork.products && subnetwork.products[String(productId)]) {
      const product = subnetwork.products[String(productId)];
      if (product.riCoverAmountPercentage !== undefined) {
        return product.riCoverAmountPercentage;
      }
    }
  }

  return null;
};

module.exports = {
  selectAssetRate,
  selectAsset,
  selectCover,
  selectProduct,
  selectProductPools,
  selectProductsInPool,
  selectRiAssetRate,
  selectProductVaults,
  selectActiveCoverAmount,
  selectVaultEpochExpiryTimestamp,
  selectRiCoverAmountPercentage,
};
