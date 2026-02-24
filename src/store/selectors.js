const { BigNumber } = require('ethers');

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

const selectActiveCoverAmount = (store, productId, now) => {
  const { covers } = store.getState();
  const nowBN = BigNumber.isBigNumber(now) ? now : BigNumber.from(now);
  return Object.values(covers).reduce((acc, cover) => {
    const coverEnd = BigNumber.from(cover.start).add(cover.period);
    const isStillActive = nowBN.lt(coverEnd);

    if (isStillActive && cover.productId === productId) {
      for (const pool of cover.poolAllocations) {
        const coverAmount = BigNumber.isBigNumber(pool.coverAmountInNxm)
          ? pool.coverAmountInNxm
          : BigNumber.from(pool.coverAmountInNxm);
        acc = acc.add(coverAmount);
      }
    }
    return acc;
  }, BigNumber.from(0));
};

const selectRiAssetRate = (store, assetId) => {
  const { riAssetRates } = store.getState();
  return riAssetRates[assetId];
};

const selectVaultProducts = (store, productId, vaultId = null) => {
  const { riSubnetworks = {}, vaultProducts = {} } = store.getState();

  if (vaultId !== null && vaultId !== undefined) {
    const key = `${productId}_${vaultId}`;
    return vaultProducts[key] || null;
  }

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

const selectVaultEpochExpiryTimestamp = store => {
  const { epochExpires = {} } = store.getState();
  return epochExpires;
};

/**
 * Gets the RI cover amount percentage for a product from riSubnetworks.
 * Returns the percentage from the first subnetwork that contains the product,
 * or null if not found (will default to RI_COVER_AMOUNT_PERCENTAGE constant).
 *
 * @param {Object} store - The Redux store containing application state.
 * @param {number|string} productId - The product ID.
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
  selectProductPriorityPoolsFixedPrice,
  selectProductsInPool,
  selectRiAssetRate,
  selectVaultProducts,
  selectActiveCoverAmount,
  selectVaultEpochExpiryTimestamp,
  selectRiCoverAmountPercentage,
};
