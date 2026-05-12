const { BigNumber, ethers } = require('ethers');

const constants = require('./constants');

const { WeiPerEther } = ethers.constants;
const { defaultAbiCoder } = ethers.utils;

/**
 * Builds an async API that reads Cover, staking, and RI contract state via ethers.
 *
 * @param {Function} contracts - Factory `(name, id?, forceNew?) => ethers.Contract` for protocol contracts.
 * @param {Object} riContracts - Map of Symbiotic/RI contract handles (`vault_*`, `delegator_*`, `asset_*`, etc.).
 * @returns {Promise<Object>} Named fetch helpers for products, pools, covers, and RI vault data.
 */
const createChainApi = async (contracts, riContracts) => {
  // contract instances
  const cover = contracts('Cover');
  const coverProducts = contracts('CoverProducts');
  const pool = contracts('Pool');
  const stakingPoolFactory = contracts('StakingPoolFactory');
  const stakingProducts = contracts('StakingProducts');
  const stakingViewer = contracts('StakingViewer');

  const NXM_ASSET_ID = '255';

  /**
   * NXM (asset id 255) is priced as 1 ether per NXM; other assets use Pool internal price.
   *
   * @param {string|number} assetId
   * @returns {Promise<BigNumber>}
   */
  const fetchTokenPriceInAsset = async assetId => {
    return assetId === NXM_ASSET_ID ? WeiPerEther : pool.getInternalTokenPriceInAsset(assetId);
  };

  /** @returns {Promise<BigNumber>} Protocol-wide capacity ratio from Cover. */
  const fetchGlobalCapacityRatio = async () => cover.getGlobalCapacityRatio();

  /** @returns {Promise<BigNumber>} Number of staking pools from the factory. */
  const fetchStakingPoolCount = async () => stakingPoolFactory.stakingPoolCount();

  /** @returns {Promise<BigNumber>} Total products registered on CoverProducts. */
  const fetchProductCount = async () => coverProducts.getProductCount();

  /** @param {number|string} poolId @returns {Promise<number[]>} */
  const fetchPoolProductIds = async poolId => {
    const products = await stakingViewer.getPoolProducts(poolId);
    return products.map(product => product.productId.toNumber());
  };

  /** @param {number|string} productId @returns {Promise<number[]>} */
  const fetchProductPoolsIds = async productId => {
    const pools = await stakingViewer.getProductPools(productId);
    return pools.map(pool => pool.poolId.toNumber());
  };

  /**
   * @param {number|string} id
   * @returns {Promise<Object>} Resolves with productType, capacityReductionRatio, useFixedPrice, gracePeriod,
   *   isDeprecated (`capacityReductionRatio` is a BigNumber).
   */
  const fetchProduct = async id => {
    const { productType, capacityReductionRatio, useFixedPrice, isDeprecated } = await coverProducts.getProduct(id);
    const { gracePeriod } = productType === 2 ? { gracePeriod: 0 } : await coverProducts.getProductType(productType);
    return { productType, capacityReductionRatio, useFixedPrice, gracePeriod, isDeprecated };
  };

  /**
   * @returns {Promise<Array<Object>>} One row per product; fields match `fetchProduct` results.
   */
  const fetchProducts = async () => {
    const products = await coverProducts.getProducts();
    const productTypes = await coverProducts.getProductTypes();

    return products.map(product => {
      const { productType, capacityReductionRatio, useFixedPrice, isDeprecated } = product;
      const gracePeriod = productTypes[product.productType].gracePeriod;
      return { productType, capacityReductionRatio, useFixedPrice, gracePeriod, isDeprecated };
    });
  };

  /**
   * @param {number|string} productId
   * @param {number|string} poolId
   * @param {BigNumber} globalCapacityRatio
   * @param {BigNumber} capacityReductionRatio
   */
  const fetchPoolProduct = async (productId, poolId, globalCapacityRatio, capacityReductionRatio) => {
    const stakingPool = contracts('StakingPool', poolId);
    console.info(`Fetching allocations for product ${productId} in pool ${poolId} at address ${stakingPool.address}`);

    // pool allocations and capacities
    const allocations = await stakingPool.getActiveAllocations(productId);
    const { trancheCapacities } = await stakingPool.getActiveTrancheCapacities(
      productId,
      globalCapacityRatio,
      capacityReductionRatio,
    );

    const {
      // product fields
      lastEffectiveWeight,
      targetWeight,
      targetPrice,
      bumpedPrice,
      bumpedPriceUpdateTime,
    } = await stakingProducts.getProduct(poolId, productId);

    return {
      allocations,
      trancheCapacities,
      lastEffectiveWeight,
      targetWeight,
      targetPrice,
      bumpedPrice,
      bumpedPriceUpdateTime,
    };
  };

  /** @returns {Promise<BigNumber>} Number of cover records. */
  const fetchCoverCount = async () => cover.getCoverDataCount();

  /**
   * @param {number|string} coverId
   * @returns {Promise<Object>} Cover fields, reference ids, and normalized pool allocations.
   */
  const fetchCover = async coverId => {
    const [{ productId, coverAsset, amount, start, period }, { originalCoverId, latestCoverId }] =
      await cover.getCoverDataWithReference(coverId);

    const poolAllocations = (await cover.getPoolAllocations(coverId)).map(poolAllocation => {
      const { poolId, coverAmountInNXM, premiumInNXM, allocationId } = poolAllocation;
      return { poolId, coverAmountInNXM, premiumInNXM, allocationId };
    });

    return { productId, coverAsset, amount, start, period, originalCoverId, latestCoverId, poolAllocations };
  };

  /** @param {number|string} coverId */
  const fetchCoverReference = async coverId => {
    const { originalCoverId, latestCoverId } = await cover.getCoverReference(coverId);
    return { originalCoverId, latestCoverId };
  };

  /**
   * @param {number|string} coverId
   * @param {number|string} poolId
   * @param {number|string} allocationId
   */
  const fetchCoverPoolTrancheAllocations = async (coverId, poolId, allocationId) => {
    const stakingPool = contracts('StakingPool', poolId);
    console.info(`Fetching allocations for cover ${coverId} in pool ${poolId} at address ${stakingPool.address}`);

    return stakingPool.coverTrancheAllocations(allocationId);
  };

  // RiContracts

  /** @param {number|string} vaultId @param {number|string} subnetworkId */
  const fetchSubnetworkStake = async (vaultId, subnetworkId) => {
    return await riContracts[`delegator_${vaultId}`].stake(subnetworkId, constants.RI_OPERATOR);
  };

  /**
   * @param {number|string} vaultId
   * @returns {Promise<BigNumber>} Next-epoch withdrawal amount scaled by RI weight constants.
   */
  const fetchVaultWithdrawals = async vaultId => {
    console.log(riContracts[`vault_${vaultId}`].address);
    const currentEpoch = await riContracts[`vault_${vaultId}`].currentEpoch();
    const withdrawalAmount = await riContracts[`vault_${vaultId}`].withdrawals(currentEpoch.add(1));
    return withdrawalAmount.mul(constants.RI_WEIGHT).div(constants.RI_WEIGHT_DENOMINATOR);
  };

  /**
   * Scans `CoverRiAllocated` logs from `blockNumber` to chain tip and groups RI allocations by `productId_vaultId`.
   *
   * @param {number} blockNumber - Starting block (inclusive).
   * @returns {Promise<Record<string, Array<Object>>>} Values include BigNumber fields amount, coverId,
   *   expiryTimestamp, originalCoverId.
   */
  const fetchVaultAllocations = async blockNumber => {
    const latestBlockNumber = await cover.provider.getBlockNumber();
    const startBlockNumber = blockNumber;
    const events = [];

    for (let fromBlock = startBlockNumber; fromBlock <= latestBlockNumber; fromBlock += 1000) {
      const toBlock = Math.min(fromBlock + 999, latestBlockNumber);
      const batchEvents = await cover.queryFilter(cover.filters.CoverRiAllocated(), fromBlock, toBlock);
      events.push(...batchEvents);
    }

    const allocations = {};

    for (const event of events) {
      const { coverId, data, dataFormat } = event.args;

      const { start, period, productId, originalCoverId } = await fetchCover(coverId);
      const coverAllocations = defaultAbiCoder.decode([constants.RI_DATA_FORMATS[dataFormat]], data);

      for (const coverAllocation of coverAllocations) {
        const { amount, vaultId } = coverAllocation;
        if (!allocations[`${productId}_${vaultId}`]) {
          allocations[`${productId}_${vaultId}`] = [];
        }

        allocations[`${productId}_${vaultId}`].push({
          amount,
          coverId,
          expiryTimestamp: BigNumber.from(start).add(period),
          originalCoverId,
        });
      }
    }

    return allocations;
  };

  /** @param {number|string} vaultId */
  const fetchVaultNextEpochStart = async vaultId => {
    return await riContracts[`vault_${vaultId}`].nextEpochStart();
  };

  /** @param {string|number} assetId */
  const fetchRiAssetRate = async assetId => {
    return {
      assetRate: await riContracts[`asset_${assetId}`].getRate(),
      quoteAssetId: riContracts[`asset_${assetId}`].quoteAssetId,
    };
  };

  return {
    fetchProducts,
    fetchProduct,
    fetchProductPoolsIds,
    fetchPoolProductIds,
    fetchGlobalCapacityRatio,
    fetchStakingPoolCount,
    fetchProductCount,
    fetchPoolProduct,
    fetchTokenPriceInAsset,
    fetchCoverCount,
    fetchCover,
    fetchCoverPoolTrancheAllocations,
    fetchCoverReference,
    fetchSubnetworkStake,
    fetchVaultWithdrawals,
    fetchVaultAllocations,
    fetchVaultNextEpochStart,
    fetchRiAssetRate,
  };
};

module.exports = createChainApi;
