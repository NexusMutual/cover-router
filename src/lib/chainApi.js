const { BigNumber, ethers } = require('ethers');

const constants = require('./constants');

const { WeiPerEther } = ethers.constants;
const { defaultAbiCoder } = ethers.utils;

/**
 * @typedef {import('../store/reducer').Cover} Cover
 * @typedef {import('../store/reducer').RiAllocation} RiAllocation
 * @typedef {import('../store/reducer').PoolProductData} PoolProductData
 */

/**
 * @typedef {Object} ProductData
 * @property {number} productType - uint16, coerced to number by ethers.
 * @property {number} capacityReductionRatio - uint16, coerced to number by ethers.
 * @property {boolean} useFixedPrice
 * @property {number} gracePeriod - uint32 from chain (coerced to number) or literal 0.
 * @property {boolean} isDeprecated
 */

/**
 * @typedef {Object} RawCoverPoolAllocation
 * @property {number} poolId - Explicitly converted via toNumber() in fetchCover.
 * @property {BigNumber} coverAmountInNXM - uint96.
 * @property {BigNumber} premiumInNXM - uint96.
 * @property {number} allocationId - uint24, coerced to number by ethers.
 */

/**
 * @typedef {Object} CoverData
 * @property {number} productId - uint24, coerced to number by ethers.
 * @property {number} coverAsset - uint8, coerced to number by ethers.
 * @property {BigNumber} amount - uint96.
 * @property {number} start - uint32, coerced to number by ethers.
 * @property {number} period - uint32, coerced to number by ethers.
 * @property {number} originalCoverId - uint32, coerced to number by ethers.
 * @property {number} latestCoverId - uint32, coerced to number by ethers.
 * @property {RawCoverPoolAllocation[]} poolAllocations
 */

/**
 * @typedef {Object} CoverReference
 * @property {number} originalCoverId - uint32, coerced to number by ethers.
 * @property {number} latestCoverId - uint32, coerced to number by ethers.
 */

/**
 * @typedef {Object} RiAssetRateResult
 * @property {BigNumber} assetRate
 * @property {number} quoteAssetId
 */

/**
 * @typedef {Object} ChainApi
 * @property {(id: number|string) => Promise<ProductData>} fetchProduct
 * @property {() => Promise<ProductData[]>} fetchProducts
 * @property {(productId: number|string) => Promise<number[]>} fetchProductPoolsIds
 * @property {(poolId: number|string) => Promise<number[]>} fetchPoolProductIds
 * @property {() => Promise<BigNumber>} fetchGlobalCapacityRatio
 * @property {() => Promise<BigNumber>} fetchStakingPoolCount
 * @property {() => Promise<BigNumber>} fetchProductCount
 * @property {(
 *   productId: number|string, poolId: number|string,
 *   globalCapacityRatio: BigNumber, capacityReductionRatio: number,
 * ) => Promise<PoolProductData>} fetchPoolProduct
 * @property {(assetId: string|number) => Promise<BigNumber>} fetchTokenPriceInAsset
 * @property {() => Promise<BigNumber>} fetchCoverCount
 * @property {(coverId: number|string) => Promise<CoverData>} fetchCover
 * @property {(
 *   coverId: number|string, poolId: number|string,
 *   allocationId: number|string,
 * ) => Promise<BigNumber>} fetchCoverPoolTrancheAllocations
 * @property {(coverId: number|string) => Promise<CoverReference>} fetchCoverReference
 * @property {(vaultId: number|string, subnetworkId: number|string) => Promise<BigNumber>} fetchSubnetworkStake
 * @property {(vaultId: number|string) => Promise<BigNumber>} fetchVaultWithdrawals
 * @property {(blockNumber: number) => Promise<Record<string, RiAllocation[]>>} fetchVaultAllocations
 * @property {(vaultId: number|string) => Promise<number>} fetchVaultNextEpochStart
 * @property {(assetId: string|number) => Promise<RiAssetRateResult>} fetchRiAssetRate
 */

/**
 * Builds an async API that reads Cover, staking, and RI contract state via ethers.
 *
 * @param {Function} contracts - Factory `(name, id?, forceNew?) => ethers.Contract` for protocol contracts.
 * @param {Object} riContracts - Map of Symbiotic/RI contract handles (`vault_*`, `delegator_*`, `asset_*`, etc.).
 * @returns {Promise<ChainApi>}
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
   * @returns {Promise<ProductData>}
   */
  const fetchProduct = async id => {
    const { productType, capacityReductionRatio, useFixedPrice, isDeprecated } = await coverProducts.getProduct(id);
    const { gracePeriod } = productType === 2 ? { gracePeriod: 0 } : await coverProducts.getProductType(productType);
    return { productType, capacityReductionRatio, useFixedPrice, gracePeriod, isDeprecated };
  };

  /**
   * @returns {Promise<ProductData[]>}
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
   * @param {number} capacityReductionRatio - uint16, coerced to number by ethers.
   * @returns {Promise<PoolProductData>}
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
   * @returns {Promise<CoverData>}
   */
  const fetchCover = async coverId => {
    const [{ productId, coverAsset, amount, start, period }, { originalCoverId, latestCoverId }] =
      await cover.getCoverDataWithReference(coverId);

    const poolAllocations = (await cover.getPoolAllocations(coverId)).map(poolAllocation => {
      const { poolId, coverAmountInNXM, premiumInNXM, allocationId } = poolAllocation;
      const poolIdNum = BigNumber.isBigNumber(poolId) ? poolId.toNumber() : Number(poolId);
      return { poolId: poolIdNum, coverAmountInNXM, premiumInNXM, allocationId };
    });

    return { productId, coverAsset, amount, start, period, originalCoverId, latestCoverId, poolAllocations };
  };

  /**
   * @param {number|string} coverId
   * @returns {Promise<CoverReference>}
   */
  const fetchCoverReference = async coverId => {
    const { originalCoverId, latestCoverId } = await cover.getCoverReference(coverId);
    return { originalCoverId, latestCoverId };
  };

  /**
   * @param {number|string} coverId
   * @param {number|string} poolId
   * @param {number|string} allocationId
   * @returns {Promise<BigNumber>} Packed tranche allocations bitmask.
   */
  const fetchCoverPoolTrancheAllocations = async (coverId, poolId, allocationId) => {
    const stakingPool = contracts('StakingPool', poolId);
    console.info(`Fetching allocations for cover ${coverId} in pool ${poolId} at address ${stakingPool.address}`);

    return stakingPool.coverTrancheAllocations(allocationId);
  };

  // RiContracts

  /**
   * @param {number|string} vaultId
   * @param {number|string} subnetworkId
   * @returns {Promise<BigNumber>}
   */
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
   * @returns {Promise<Record<string, RiAllocation[]>>}
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
      const { coverId, data, dataFormatVersion } = event.args;

      const { start, period, productId, originalCoverId } = await fetchCover(coverId);
      const [coverAllocations] = defaultAbiCoder.decode([constants.RI_DATA_FORMATS[dataFormatVersion]], data);

      for (const coverAllocation of coverAllocations) {
        const { amount, vaultId } = coverAllocation;
        if (!allocations[`${productId}_${vaultId}`]) {
          allocations[`${productId}_${vaultId}`] = [];
        }

        allocations[`${productId}_${vaultId}`].push({
          amount,
          coverId: BigNumber.from(coverId).toNumber(),
          expiryTimestamp: start + period,
          originalCoverId,
        });
      }
    }

    return allocations;
  };

  /**
   * @param {number|string} vaultId
   * @returns {Promise<number>} uint48, coerced to number by ethers.
   */
  const fetchVaultNextEpochStart = async vaultId => {
    return await riContracts[`vault_${vaultId}`].nextEpochStart();
  };

  /**
   * @param {string|number} assetId
   * @returns {Promise<RiAssetRateResult>}
   */
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
