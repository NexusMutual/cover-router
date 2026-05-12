const { ethers } = require('ethers');

const constants = require('./constants');
const { calculateTrancheId, promiseAllInBatches, decodeRiData } = require('./helpers');
const config = require('../config');
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
} = require('../store/actions');

const { BigNumber } = ethers;
const { WeiPerEther } = ethers.constants;
const { FETCH_COVER_DATA_FROM_ID, RI_FETCH_COVER_DATA_FROM_BLOCK } = constants;

/**
 * Wires blockchain/event callbacks to Redux: refreshes products, pools, covers, asset rates, and RI vault state.
 *
 * @param {Object} store - Redux store (dispatch + `getState`).
 * @param {Object} chainApi - Async readers from `createChainApi`.
 * @param {{ on: Function }} eventsApi - Emitter API from `eventsApi` factory.
 * @returns {Promise<Object>} Imperative update helpers (`updateAll`, `updateAssetRates`, …).
 */
module.exports = async (store, chainApi, eventsApi) => {
  /**
   * Reloads one product’s metadata and all its pool staking rows into the store.
   *
   * @param {number|string} productId
   */
  const updateProduct = async productId => {
    const { globalCapacityRatio } = store.getState();

    const product = await chainApi.fetchProduct(productId);
    store.dispatch({ type: SET_PRODUCT, payload: { ...product, id: productId } });

    const { capacityReductionRatio } = product;
    const poolIds = await chainApi.fetchProductPoolsIds(productId);

    store.dispatch({
      type: RESET_PRODUCT_POOLS,
      payload: { productId, poolIds },
    });

    for (const poolId of poolIds) {
      const poolProduct = await chainApi.fetchPoolProduct(
        productId,
        poolId,
        globalCapacityRatio,
        capacityReductionRatio,
      );
      store.dispatch({
        type: SET_POOL_PRODUCT,
        payload: { productId, poolId, poolProduct },
      });
    }
    console.info(`Update: product data for product with id ${productId}`);
  };

  /**
   * Reloads staking data for every product linked to a single pool.
   *
   * @param {number|string} poolId
   */
  async function updatePool(poolId) {
    const { globalCapacityRatio, products } = store.getState();
    const productIds = await chainApi.fetchPoolProductIds(poolId);
    for (const productId of productIds) {
      const poolProduct = await chainApi.fetchPoolProduct(
        productId,
        poolId,
        globalCapacityRatio,
        products[productId].capacityReductionRatio,
      );
      store.dispatch({
        type: SET_POOL_PRODUCT,
        payload: { productId, poolId, poolProduct },
      });
    }
    console.info(`Update: Pool data for pool with id ${poolId}`);
  }

  /**
   * Full refresh: tranche id, global capacity ratio, all products/pools, then covers from `FETCH_COVER_DATA_FROM_ID`.
   */
  const updateAll = async () => {
    const trancheId = calculateTrancheId(Math.floor(Date.now() / 1000));
    store.dispatch({ type: SET_TRANCHE_ID, payload: trancheId });

    const globalCapacityRatio = await chainApi.fetchGlobalCapacityRatio();
    store.dispatch({ type: SET_GLOBAL_CAPACITY_RATIO, payload: globalCapacityRatio });

    const productCount = await chainApi.fetchProductCount();

    const productIds = Array.from({ length: productCount }, (_, i) => i);
    const concurrency = config.get('concurrency');

    await promiseAllInBatches(productId => updateProduct(productId), productIds, concurrency);

    const coverCount = await chainApi.fetchCoverCount();
    const coverIds = Array.from(
      { length: coverCount - FETCH_COVER_DATA_FROM_ID + 1 },
      (_, i) => FETCH_COVER_DATA_FROM_ID + i,
    );

    await promiseAllInBatches(coverId => updateCover(coverId), coverIds, concurrency);
  };

  /** Updates protocol asset NXM rates and derived RI asset rates in the store. */
  const updateAssetRates = async () => {
    // Protocol Assets
    const { assets } = store.getState();
    const assetIds = Object.keys(assets);
    for (const assetId of assetIds) {
      const rate = await chainApi.fetchTokenPriceInAsset(assetId);
      store.dispatch({ type: SET_ASSET_RATE, payload: { assetId, rate } });
    }
    console.info('Update: Asset rates');

    // RI Assets
    const { riAssets, assetRates } = store.getState();
    const riAssetIds = Object.keys(riAssets);

    for (const assetId of riAssetIds) {
      const { assetRate, quoteAssetId } = await chainApi.fetchRiAssetRate(assetId);
      const quoteAssetRate = assetRates[quoteAssetId];
      // note: divide by 10 ** decimals of assetId
      const rate = assetRate.mul(quoteAssetRate).div(WeiPerEther);
      store.dispatch({ type: SET_RI_ASSET_RATE, payload: { assetId, rate } });
    }
    console.info('Update: RI asset rates');
  };

  /**
   * Fetches cover primary data and per-pool tranche-packed allocations, then dispatches `SET_COVER`.
   *
   * @param {number|string|BigNumber} coverId - Id from HTTP routes or event args (ethers may pass BN).
   */
  const updateCover = async coverId => {
    const cover = await chainApi.fetchCover(coverId);
    cover.poolAllocations = await Promise.all(
      cover.poolAllocations.map(async allocationInfo => ({
        ...allocationInfo,
        packedTrancheAllocations: await chainApi.fetchCoverPoolTrancheAllocations(
          coverId,
          allocationInfo.poolId,
          allocationInfo.allocationId,
        ),
      })),
    );

    store.dispatch({ type: SET_COVER, payload: { coverId, cover } });
    console.info(`Update: Cover data for cover id ${coverId}`);
  };

  /** Updates original/latest cover id pointers for edit chains. @param {number|string} coverId */
  const updateCoverReference = async coverId => {
    const { originalCoverId, latestCoverId } = await chainApi.fetchCoverReference(coverId);
    store.dispatch({ type: SET_COVER_REFERENCE, payload: { coverId, originalCoverId, latestCoverId } });
    console.info(`Update: Cover reference for cover id ${coverId}`);
  };

  /**
   * Applies decoded RI allocations from a `CoverRiAllocated` event into `vaultProducts` and bumps provider nonces.
   *
   * @param {number|string|BigNumber} coverId
   * @param {string|Uint8Array} data - ABI-encoded allocation list (`bytes` from `CoverRiAllocated`).
   * @param {number|BigNumber} dataFormat
   */
  const updateRiVaultProductAllocations = async (coverId, data, dataFormat) => {
    const allocations = decodeRiData(data, dataFormat);
    const { vaultProducts } = store.getState();
    const { productId, originalCoverId, start, period } = await chainApi.fetchCover(coverId);
    const now = Math.floor(Date.now() / 1000);

    const providerIds = new Set();
    for (const allocation of allocations) {
      providerIds.add(allocation.providerId);
      const { amount, vaultId } = allocation;
      const vaultProductId = `${productId}_${vaultId}`;
      const { allocations } = vaultProducts[vaultProductId];

      const newAllocations = allocations.filter(
        allocation => allocation.originalCoverId !== originalCoverId && allocation.expiryTimestamp.gt(now),
      );

      store.dispatch({
        type: SET_RI_VAULT_PRODUCT,
        payload: {
          vaultProductId,
          allocations: [
            ...newAllocations,
            { amount, coverId, expiryTimestamp: BigNumber.from(start).add(period), originalCoverId },
          ],
        },
      });
    }
    for (const providerId of providerIds) {
      store.dispatch({ type: SET_RI_NONCE, payload: { providerId } });
    }
    console.info('Update: RI vault products');
  };

  /**
   * Advances RI epoch expiry timestamps that have passed and refreshes affected vault capacity.
   *
   * @param {number} timestamp - Typically latest block time in seconds.
   */
  const updateEpoch = async timestamp => {
    const { epochExpires } = store.getState();
    const expiredEpochs = Object.entries(epochExpires).filter(([key, value]) => value <= timestamp);
    const expiries = {};

    for (const epochExpiration of expiredEpochs) {
      const [vaultId] = epochExpiration;
      expiries[vaultId] = await chainApi.fetchVaultNextEpochStart(vaultId);
      await updateRiVaultCapacity(vaultId);
    }

    store.dispatch({ type: SET_RI_EPOCH_EXPIRIES, payload: { expiries } });
  };

  /**
   * Picks the dominant subnetwork stake for a product using per-subnetwork weights.
   *
   * @param {number|string} productId
   * @param {Array<Object>} subnetworks - Subnetwork rows including `products` weights.
   * @param {Object<string, BigNumber>} subnetworkStakes - Fetched stake per subnetwork id.
   * @returns {{ activeStake: BigNumber, subnetworkId: string|null }}
   */
  const calculateVaultStake = (productId, subnetworks, subnetworkStakes) => {
    let maxWeightedStake = BigNumber.from(0);
    let maxStakeSubnetworkId = null;

    for (const subnetwork of subnetworks) {
      const subnetworkStake = subnetworkStakes[subnetwork.id];
      if (!subnetworkStake) {
        continue;
      }

      const subnetworkProduct = subnetwork.products[String(productId)];

      if (!subnetworkProduct) {
        continue;
      }

      const weight = subnetworkProduct.weight || constants.RI_WEIGHT;

      // Calculate weighted stake for this subnetwork: stake * weight / 100
      const weightedStake = subnetworkStake.mul(weight).div(constants.RI_WEIGHT_DENOMINATOR);

      // Keep track of the maximum weighted stake across all subnetworks
      // This allows a subnetwork with lower stake but higher weight to win
      maxWeightedStake = weightedStake.gt(maxWeightedStake) ? weightedStake : maxWeightedStake;
      maxStakeSubnetworkId = subnetwork.id;
    }

    return {
      activeStake: maxWeightedStake,
      subnetworkId: maxStakeSubnetworkId,
    };
  };

  /**
   * Recomputes weighted stakes, withdrawals, and dispatch payload for one vault across its subnetworks.
   *
   * @param {number|string} vaultId
   */
  const updateRiVaultCapacity = async vaultId => {
    const { riSubnetworks } = store.getState();
    const vaultSubnetworks = Object.entries(riSubnetworks)
      .map(([subnetworkId, subnetwork]) => ({ id: subnetworkId, ...subnetwork }))
      .filter(subnetwork => subnetwork.vaults.includes(vaultId));

    // get deduplicated product ids from all subnetworks of this vault
    const productIds = [...new Set(vaultSubnetworks.flatMap(subnetwork => Object.keys(subnetwork.products)))];

    const subnetworkStakes = {};

    for (const subnetwork of vaultSubnetworks) {
      subnetworkStakes[subnetwork.id] = await chainApi.fetchSubnetworkStake(vaultId, subnetwork.id);
    }

    const withdrawalAmount = await chainApi.fetchVaultWithdrawals(vaultId);

    // calculate activeStake for each product based on its weight
    const productStakes = productIds.reduce((acc, productId) => {
      const { activeStake, subnetworkId } = calculateVaultStake(productId, vaultSubnetworks, subnetworkStakes);
      return { ...acc, [productId]: { activeStake, subnetworkId } };
    }, {});

    store.dispatch({
      type: SET_VAULT_STAKE,
      payload: { vaultId, productIds, productStakes, withdrawalAmount },
    });
  };

  /**
   * Per-block maintenance: asset rates and RI epoch rollover.
   *
   * @param {number} blockNumber
   * @param {number} blockTimestamp - Unix seconds.
   */
  const updatesOnBlockMined = async (blockNumber, blockTimestamp) => {
    return Promise.all([updateAssetRates(), updateEpoch(blockTimestamp)]);
  };

  /**
   * Cold-load RI state: historical vault allocations from logs plus stakes, expiries, and vault product map.
   */
  const updateRiData = async () => {
    const allAllocations = await chainApi.fetchVaultAllocations(RI_FETCH_COVER_DATA_FROM_BLOCK);
    const { riSubnetworks } = store.getState();
    const vaultProducts = {};
    const expiries = {};
    const subnetworkStakes = {};
    const vaultProductsMaping = {};

    // Fetch vault stakes and expiries
    for (const subnetwork of Object.values(riSubnetworks)) {
      const { vaults, products } = subnetwork;
      for (const vaultId of vaults) {
        subnetworkStakes[vaultId] = await chainApi.fetchSubnetworkStake(vaultId, subnetwork.id);
        vaultProductsMaping[vaultId] = new Set([...(vaultProductsMaping[vaultId] || []), ...products]);
        if (!expiries[vaultId]) {
          expiries[vaultId] = await chainApi.fetchVaultNextEpochStart(vaultId);
        }
      }
    }

    // Fetch product data
    for (const [vaultId, products] of Object.entries(vaultProductsMaping)) {
      const withdrawalAmount = await chainApi.fetchVaultWithdrawals(vaultId);
      for (const product of Object.values(products)) {
        // Calculate activeStake for each product based on its weight
        const { activeStake, subnetworkId } = calculateVaultStake(product.productId, riSubnetworks, subnetworkStakes);
        const key = `${product.productId}_${vaultId}`;
        vaultProducts[key] = {
          vaultId,
          product: product.productId,
          allocations: allAllocations[key] || [],
          price: product.price,
          activeStake,
          withdrawalAmount,
          subnetworkId,
        };
      }
    }

    store.dispatch({ type: SET_RI_VAULT_PRODUCTS, payload: { vaultProducts } });
    store.dispatch({ type: SET_RI_EPOCH_EXPIRIES, payload: { expiries } });
  };

  eventsApi.on('pool:change', updatePool);
  eventsApi.on('cover:bought', updateCover);
  eventsApi.on('cover:edit', updateCoverReference);
  eventsApi.on('product:change', updateProduct);
  eventsApi.on('tranche:change', updateAll);
  eventsApi.on('bucket:change', updateAll);
  eventsApi.on('block', updatesOnBlockMined);
  // RI vault updates
  eventsApi.on('ri:bought', updateRiVaultProductAllocations);
  eventsApi.on('ri:withdraw', updateRiVaultCapacity);
  eventsApi.on('ri:deposit', updateRiVaultCapacity);
  eventsApi.on('ri:slash', updateRiVaultCapacity);
  eventsApi.on('ri:setMaxNetworkLimit', updateRiVaultCapacity);
  eventsApi.on('ri:setNetworkLimit', updateRiVaultCapacity);

  return {
    updateAll,
    updateAssetRates,
    updateCover,
    updateCoverReference,
    updateEpoch,
    updateRiVaultProductAllocations,
    updateRiVaultCapacity,
    updatesOnBlockMined,
    updateRiData,
  };
};
