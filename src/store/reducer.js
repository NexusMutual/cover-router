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

/**
 * @typedef {import('ethers').BigNumber} BigNumber
 */

/**
 * @typedef {Object} Asset
 * @property {number} id
 * @property {string} symbol
 * @property {number} decimals
 */

/**
 * @typedef {Object} Product
 * @property {number} id
 * @property {number} productType - uint16, coerced to number by ethers.
 * @property {number} capacityReductionRatio - uint16, coerced to number by ethers.
 * @property {boolean} useFixedPrice
 * @property {number} gracePeriod - uint32, coerced to number by ethers (or literal 0).
 * @property {boolean} isDeprecated
 */

/**
 * @typedef {Object} PoolProduct
 * @property {number} productId
 * @property {number} poolId
 * @property {BigNumber[]} allocations - Per-tranche allocation counts.
 * @property {BigNumber[]} trancheCapacities - Per-tranche capacity limits.
 * @property {BigNumber} lastEffectiveWeight
 * @property {BigNumber} targetWeight
 * @property {BigNumber} targetPrice
 * @property {BigNumber} bumpedPrice
 * @property {BigNumber} bumpedPriceUpdateTime
 */

/**
 * @typedef {Object} CoverPoolAllocation
 * @property {number} poolId
 * @property {BigNumber} coverAmountInNXM - uint96.
 * @property {BigNumber} premiumInNXM - uint96.
 * @property {number} allocationId - uint24, coerced to number by ethers.
 * @property {BigNumber} packedTrancheAllocations - uint256 bitmask added by synchronizer.
 */

/**
 * @typedef {Object} Cover
 * @property {number} coverId - Set by synchronizer before dispatch.
 * @property {number} productId - uint24, coerced to number by ethers.
 * @property {number} coverAsset - uint8, coerced to number by ethers.
 * @property {BigNumber} amount - uint96.
 * @property {number} start - uint32, coerced to number by ethers.
 * @property {number} period - uint32, coerced to number by ethers.
 * @property {number} originalCoverId - uint32, coerced to number by ethers.
 * @property {number} latestCoverId - uint32, coerced to number by ethers.
 * @property {CoverPoolAllocation[]} poolAllocations
 */

/**
 * @typedef {Object} RiAllocation
 * @property {BigNumber} amount
 * @property {number} coverId - Normalized to number in chainApi/eventsApi.
 * @property {number} expiryTimestamp - start + period, both uint32 -> number.
 * @property {number} originalCoverId - uint32, coerced to number by ethers.
 */

/**
 * @typedef {Object} VaultProduct
 * @property {string} id - Same as vaultId; used as `riVaultId` in quote data.
 * @property {string} vaultId
 * @property {number} asset - RI asset id (key into `riAssetRates`).
 * @property {number} providerId - Symbiotic provider id.
 * @property {RiAllocation[]} allocations
 * @property {BigNumber} activeStake - Weighted stake in vault-asset units.
 * @property {BigNumber} withdrawalAmount - Next-epoch withdrawal in vault-asset units.
 * @property {number} price - Annual price in basis points from riSubnetworks config.
 * @property {number} product - The productId this row belongs to.
 * @property {string|null} subnetworkId - Dominant subnetwork id for this product's stake.
 */

/**
 * @typedef {Object} RiSubnetworkProduct
 * @property {number} productId
 * @property {number} price
 * @property {number} weight
 * @property {number} [riCoverAmountPercentage]
 */

/**
 * @typedef {Object} RiSubnetwork
 * @property {string} id - Subnetwork identifier (hex).
 * @property {Object<string, RiSubnetworkProduct>} products - Keyed by productId.
 * @property {string[]} vaults - Vault ids belonging to this subnetwork.
 */

/**
 * @typedef {Object} StoreState
 * @property {Object<string, RiSubnetwork>} riSubnetworks
 * @property {Object<string, BigNumber>} assetRates - assetId → NXM exchange rate.
 * @property {Object<number, Asset>} assets
 * @property {Object<string, BigNumber>} riAssetRates - RI assetId → NXM exchange rate.
 * @property {Object<number, Asset>} riAssets
 * @property {BigNumber|number} globalCapacityRatio
 * @property {Object<string, PoolProduct>} poolProducts - `${productId}_${poolId}` → pool product.
 * @property {Object<string, number[]>} productPoolIds - productId → pool id list.
 * @property {Object<string, Product>} products - productId → product.
 * @property {Object<string, Cover>} covers - coverId → cover.
 * @property {number} trancheId
 * @property {Object<string, VaultProduct>} vaultProducts - `${productId}_${vaultId}` → vault product.
 * @property {Object<string, number>} epochExpires - vaultId -> epoch expiry timestamp (uint48, number).
 * @property {Object<string, number>} riNonces - providerId → nonce.
 */

/**
 * @typedef {Object} Store
 * @property {() => StoreState} getState
 * @property {(action: Action) => void} dispatch
 */

// -- Action payload types (one per reducer branch) --

/**
 * @typedef {Object} PoolProductData
 * @property {BigNumber[]} allocations
 * @property {BigNumber[]} trancheCapacities
 * @property {BigNumber} lastEffectiveWeight
 * @property {BigNumber} targetWeight
 * @property {BigNumber} targetPrice
 * @property {BigNumber} bumpedPrice
 * @property {BigNumber} bumpedPriceUpdateTime
 */

/**
 * @typedef {Object} ProductStakeEntry
 * @property {BigNumber} activeStake
 * @property {string|null} subnetworkId
 */

/**
 * @typedef {Object} SetProductAction
 * @property {'SET_PRODUCT'} type
 * @property {Product} payload
 */

/**
 * @typedef {Object} SetPoolProductPayload
 * @property {number} productId
 * @property {number} poolId
 * @property {PoolProductData} poolProduct
 */

/**
 * @typedef {Object} SetPoolProductAction
 * @property {'SET_POOL_PRODUCT'} type
 * @property {SetPoolProductPayload} payload
 */

/**
 * @typedef {Object} SetAssetRatePayload
 * @property {string|number} assetId
 * @property {BigNumber} rate
 */

/**
 * @typedef {Object} SetAssetRateAction
 * @property {'SET_ASSET_RATE'} type
 * @property {SetAssetRatePayload} payload
 */

/**
 * @typedef {Object} SetGlobalCapacityRatioAction
 * @property {'SET_GLOBAL_CAPACITY_RATIO'} type
 * @property {BigNumber} payload
 */

/**
 * @typedef {Object} SetTrancheIdAction
 * @property {'SET_TRANCHE_ID'} type
 * @property {number} payload
 */

/**
 * @typedef {Object} SetCoverPayload
 * @property {number|string} coverId
 * @property {Cover} cover
 */

/**
 * @typedef {Object} SetCoverAction
 * @property {'SET_COVER'} type
 * @property {SetCoverPayload} payload
 */

/**
 * @typedef {Object} SetCoverReferencePayload
 * @property {number|string} coverId
 * @property {number} originalCoverId - uint32, coerced to number by ethers.
 * @property {number} latestCoverId - uint32, coerced to number by ethers.
 */

/**
 * @typedef {Object} SetCoverReferenceAction
 * @property {'SET_COVER_REFERENCE'} type
 * @property {SetCoverReferencePayload} payload
 */

/**
 * @typedef {Object} ResetProductPoolsPayload
 * @property {number|string} productId
 * @property {number[]} poolIds
 */

/**
 * @typedef {Object} ResetProductPoolsAction
 * @property {'RESET_PRODUCT_POOLS'} type
 * @property {ResetProductPoolsPayload} payload
 */

/**
 * @typedef {Object} SetRiAssetRateAction
 * @property {'SET_RI_ASSET_RATE'} type
 * @property {SetAssetRatePayload} payload
 */

/**
 * @typedef {Object} SetRiVaultProductPayload
 * @property {string} vaultProductId
 * @property {RiAllocation[]} allocations
 */

/**
 * @typedef {Object} SetRiVaultProductAction
 * @property {'SET_RI_VAULT_PRODUCT'} type
 * @property {SetRiVaultProductPayload} payload
 */

/**
 * @typedef {Object} SetRiVaultProductsAction
 * @property {'SET_RI_VAULT_PRODUCTS'} type
 * @property {{ vaultProducts: Object<string, VaultProduct> }} payload
 */

/**
 * @typedef {Object} SetRiEpochExpiriesAction
 * @property {'SET_RI_EPOCH_EXPIRIES'} type
 * @property {{ expiries: Object<string, number> }} payload
 */

/**
 * @typedef {Object} SetVaultStakePayload
 * @property {string} vaultId
 * @property {string[]} productIds
 * @property {Object<string, ProductStakeEntry>} productStakes
 * @property {BigNumber} withdrawalAmount
 */

/**
 * @typedef {Object} SetVaultStakeAction
 * @property {'SET_VAULT_STAKE'} type
 * @property {SetVaultStakePayload} payload
 */

/**
 * @typedef {Object} SetRiNonceAction
 * @property {'SET_RI_NONCE'} type
 * @property {{ providerId: BigNumber }} payload
 */

/**
 * @typedef {SetProductAction | SetPoolProductAction | SetAssetRateAction | SetGlobalCapacityRatioAction
 *   | SetTrancheIdAction | SetCoverAction | SetCoverReferenceAction | ResetProductPoolsAction
 *   | SetRiAssetRateAction | SetRiVaultProductAction | SetRiVaultProductsAction | SetRiEpochExpiriesAction
 *   | SetVaultStakeAction | SetRiNonceAction} Action
 */

/** @type {StoreState} */
const initialState = {
  riSubnetworks,
  assetRates: {},
  assets: {
    0: { id: 0, symbol: 'ETH', decimals: 18 },
    1: { id: 1, symbol: 'DAI', decimals: 18 },
    6: { id: 6, symbol: 'USDC', decimals: 6 },
    7: { id: 7, symbol: 'cbBTC', decimals: 8 },
    255: { id: 255, symbol: 'NXM', decimals: 18 },
  },
  riAssetRates: {},
  riAssets: {
    0: { id: 0, symbol: 'wstETH', decimals: 18 },
  },
  globalCapacityRatio: 0,
  poolProducts: {}, // {productId}_{poolId} -> { allocations, trancheCapacities }
  productPoolIds: {}, // productId -> [ poolIds ]
  products: {}, // productId -> { product }
  covers: {}, // coverId -> { cover }
  trancheId: 0,
  vaultProducts: {}, // {productId}_{vaultId} -> { id, vaultId, asset, providerId, allocations, activeStake, … }
  epochExpires: {}, // vaultId -> timestamp
  riNonces: {},
};

/**
 * @param {StoreState} state
 * @param {Action} action
 * @returns {StoreState}
 */
function reducer(state = initialState, action) {
  if (action.type === SET_PRODUCT) {
    const product = { ...action.payload };
    const products = { ...state.products, [product.id]: product };
    return { ...state, products };
  }

  // TODO: handle product removal
  if (action.type === SET_POOL_PRODUCT) {
    const { productId, poolId, poolProduct } = action.payload;
    const key = `${productId}_${poolId}`;
    const newPoolProduct = { productId, poolId, ...poolProduct };
    const poolProducts = { ...state.poolProducts, [key]: newPoolProduct };
    const previousIds = state.productPoolIds[productId] || [];
    const newIds = [...new Set([...previousIds, poolId])];
    const productPoolIds = { ...state.productPoolIds, [productId]: newIds };
    return { ...state, poolProducts, productPoolIds };
  }

  if (action.type === SET_ASSET_RATE) {
    const { assetId, rate } = action.payload;
    const assetRates = { ...state.assetRates, [assetId]: rate };
    return { ...state, assetRates };
  }

  if (action.type === SET_GLOBAL_CAPACITY_RATIO) {
    return { ...state, globalCapacityRatio: action.payload };
  }

  if (action.type === SET_TRANCHE_ID) {
    return { ...state, trancheId: action.payload };
  }

  if (action.type === SET_COVER) {
    const { cover } = action.payload;
    const covers = { ...state.covers, [cover.coverId]: cover };
    return { ...state, covers };
  }

  if (action.type === SET_COVER_REFERENCE) {
    const { coverId, originalCoverId, latestCoverId } = action.payload;
    const covers = { ...state.covers, [coverId]: { ...state.covers[coverId], originalCoverId, latestCoverId } };
    return { ...state, covers };
  }

  if (action.type === RESET_PRODUCT_POOLS) {
    const { productId, poolIds } = action.payload;
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

  if (action.type === SET_RI_ASSET_RATE) {
    const { assetId, rate } = action.payload;
    const riAssetRates = { ...state.riAssetRates, [assetId]: rate };
    return { ...state, riAssetRates };
  }

  if (action.type === SET_RI_VAULT_PRODUCT) {
    const { vaultProductId, allocations } = action.payload;
    const vaultProduct = state.vaultProducts[vaultProductId];
    const vaultProducts = { ...state.vaultProducts, [vaultProductId]: { ...vaultProduct, allocations } };
    return { ...state, vaultProducts };
  }

  if (action.type === SET_VAULT_STAKE) {
    const { vaultId, productIds, productStakes, withdrawalAmount } = action.payload;
    const newVaultProducts = {};
    for (const productId of productIds) {
      const key = `${productId}_${vaultId}`;
      newVaultProducts[key] = {
        ...state.vaultProducts[key],
        activeStake: productStakes[productId].activeStake,
        subnetworkId: productStakes[productId].subnetworkId,
        withdrawalAmount,
      };
    }
    const vaultProducts = { ...state.vaultProducts, ...newVaultProducts };
    return { ...state, vaultProducts };
  }

  if (action.type === SET_RI_EPOCH_EXPIRIES) {
    const { expiries } = action.payload;

    return { ...state, epochExpires: { ...state.epochExpires, ...expiries } };
  }

  if (action.type === SET_RI_VAULT_PRODUCTS) {
    const { vaultProducts } = action.payload;
    return { ...state, vaultProducts: { ...state.vaultProducts, ...vaultProducts } };
  }

  if (action.type === SET_RI_NONCE) {
    const { providerId } = action.payload;
    const nonce = state.riNonces[providerId] || 0;
    return { ...state, riNonces: { ...state.riNonces, [providerId]: nonce + 1 } };
  }

  return state;
}

module.exports = {
  initialState,
  reducer,
};
