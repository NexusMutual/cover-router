const { ethers } = require('ethers');

const { FETCH_COVER_DATA_FROM_ID, RI_FETCH_COVER_DATA_FROM_BLOCK } = require('./constants');
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

const { WeiPerEther } = ethers.constants;

module.exports = async (store, chainApi, eventsApi) => {
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

  const updateAssetRates = async () => {
    const { assets } = store.getState();
    const assetIds = Object.keys(assets);
    for (const assetId of assetIds) {
      const rate = await chainApi.fetchTokenPriceInAsset(assetId);
      store.dispatch({ type: SET_ASSET_RATE, payload: { assetId, rate } });
    }

    await updateRiAssetNXMRates();
    console.info('Update: Asset rates');
  };

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

  const updateCoverReference = async coverId => {
    const { originalCoverId, latestCoverId } = await chainApi.fetchCoverReference(coverId);
    store.dispatch({ type: SET_COVER_REFERENCE, payload: { coverId, originalCoverId, latestCoverId } });
    console.info(`Update: Cover reference for cover id ${coverId}`);
  };

  const updateRiVaultProductAllocations = async (coverId, data, dataFormat) => {
    const allocations = decodeRiData(data, dataFormat);
    const { vaultProducts } = store.getState();
    const { productId, originalCoverId, start, period } = await chainApi.fetchCover(coverId);
    const now = Math.floor(Date.now() / 1000);
    for (const allocation of allocations) {
      const { amount, vaultId } = allocation;
      const vaultProductId = `${productId}_${vaultId}`;
      const { allocations } = vaultProducts[vaultProductId];

      const newAllocations = allocations.filter(
        allocation => allocation.originalCoverId !== originalCoverId && allocation.expiryTimestamp > now,
      );

      store.dispatch({
        type: SET_RI_VAULT_PRODUCT,
        payload: {
          vaultProductId,
          allocations: [...newAllocations, { amount, coverId, expiryTimestamp: start + period, originalCoverId }],
        },
      });
    }
    console.info('Update: RI vault products');
  };

  const updateRiAssetNXMRates = async () => {
    const { riAssets, assetRates } = store.getState();
    const assetIds = Object.keys(riAssets);

    for (const assetId of assetIds) {
      const { assetRate, protocolAssetCorrelationId } = await chainApi.fetchRiAssetRate(assetId);
      const internalAssetRate = assetRates[protocolAssetCorrelationId];
      const rate = assetRate.mul(internalAssetRate).div(WeiPerEther);
      store.dispatch({ type: SET_RI_ASSET_RATE, payload: { assetId, rate } });
    }
    console.info('Update: RI asset rates');
  };

  const updateEpoch = async timestamp => {
    const { epochExpiries } = store.getState();
    const expiredEpochs = Object.entries(epochExpiries).filter(([key, value]) => value <= timestamp);
    const expiries = {};

    for (const epochExpiration of expiredEpochs) {
      const [vaultId] = epochExpiration;
      expiries[vaultId] = await chainApi.fetchVaultNextEpochStart(vaultId);
      await updateRiVaultCapacity(vaultId);
    }

    store.dispatch({ type: SET_RI_EPOCH_EXPIRIES, payload: { expiries } });
  };

  const updateRiVaultCapacity = async vaultId => {
    const { riSubnetworks } = store.getState();
    const productIds = Object.values(riSubnetworks).reduce((acc, { products }) => {
      const subnetworkProductIds = Object.keys(products);
      return [...new Set([...acc, ...subnetworkProductIds])];
    }, []);

    // Calculate activeStake for each product based on its weight in parallel
    const [withdrawalAmount, ...stakeResults] = await Promise.all([
      chainApi.fetchVaultWithdrawals(vaultId),
      ...productIds.map(productId =>
        chainApi
          .fetchVaultStake(vaultId, Object.keys(riSubnetworks), productId, riSubnetworks)
          .then(activeStake => ({ productId, activeStake })),
      ),
    ]);

    // Build productStakes object from results
    const productStakes = {};
    stakeResults.forEach(({ productId, activeStake }) => {
      productStakes[productId] = activeStake;
    });

    store.dispatch({
      type: SET_VAULT_STAKE,
      payload: { vaultId, productIds, productStakes, withdrawalAmount },
    });
  };

  const updatesOnBlockMined = async (blockNumber, blockTimestamp) => {
    return Promise.all([updateAssetRates, () => updateEpoch(blockTimestamp)]);
  };

  const updateRiData = async () => {
    const allAllocations = await chainApi.fetchVaultAllocations(RI_FETCH_COVER_DATA_FROM_BLOCK);
    const { riSubnetworks } = store.getState();
    const vaultProducts = {};
    for (const subnetwork of Object.values(riSubnetworks)) {
      const { vaults, products } = subnetwork;
      for (const vaultId of vaults) {
        const withdrawalAmount = await chainApi.fetchVaultWithdrawals(vaultId);
        for (const product of Object.values(products)) {
          // Calculate activeStake for each product based on its weight
          const activeStake = await chainApi.fetchVaultStake(
            vaultId,
            Object.keys(riSubnetworks),
            product.productId,
            riSubnetworks,
          );
          const key = `${product.productId}_${vaultId}`;
          vaultProducts[key] = {
            vaultId,
            product: product.productId,
            allocations: allAllocations[key] || [],
            price: product.price,
            activeStake,
            withdrawalAmount,
          };
        }
      }
    }
    store.dispatch({ type: SET_RI_VAULT_PRODUCTS, payload: { vaultProducts } });
  };

  const updateRiNonce = async providerId => {
    const { riNonces } = store.getState();
    const nonce = riNonces[providerId] + 1;

    store.dispatch({ type: SET_RI_NONCE, payload: { providerId, nonce } });
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
    updateRiAssetNXMRates,
    updateRiVaultProductAllocations,
    updateRiVaultCapacity,
    updatesOnBlockMined,
    updateRiData,
    updateRiNonce,
  };
};
