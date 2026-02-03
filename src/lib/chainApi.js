const { BigNumber, ethers } = require('ethers');

const constants = require('./constants');

const { WeiPerEther } = ethers.constants;
const { defaultAbiCoder } = ethers.utils;

const createChainApi = async (contracts, riContracts) => {
  // contract instances
  const cover = contracts('Cover');
  const coverProducts = contracts('CoverProducts');
  const pool = contracts('Pool');
  const stakingPoolFactory = contracts('StakingPoolFactory');
  const stakingProducts = contracts('StakingProducts');
  const stakingViewer = contracts('StakingViewer');

  const NXM_ASSET_ID = '255';

  const fetchTokenPriceInAsset = async assetId => {
    return assetId === NXM_ASSET_ID ? WeiPerEther : pool.getInternalTokenPriceInAsset(assetId);
  };

  const fetchGlobalCapacityRatio = async () => cover.getGlobalCapacityRatio();

  const fetchStakingPoolCount = async () => stakingPoolFactory.stakingPoolCount();

  const fetchProductCount = async () => coverProducts.getProductCount();

  const fetchPoolProductIds = async poolId => {
    const products = await stakingViewer.getPoolProducts(poolId);
    return products.map(product => product.productId.toNumber());
  };

  const fetchProductPoolsIds = async productId => {
    const pools = await stakingViewer.getProductPools(productId);
    return pools.map(pool => pool.poolId.toNumber());
  };

  const fetchProduct = async id => {
    const { productType, capacityReductionRatio, useFixedPrice, isDeprecated } = await coverProducts.getProduct(id);
    const { gracePeriod } = productType === 2 ? { gracePeriod: 0 } : await coverProducts.getProductType(productType);
    return { productType, capacityReductionRatio, useFixedPrice, gracePeriod, isDeprecated };
  };

  const fetchProducts = async () => {
    const products = await coverProducts.getProducts();
    const productTypes = await coverProducts.getProductTypes();

    return products.map((product, id) => {
      const { productType, capacityReductionRatio, useFixedPrice, isDeprecated } = product;
      const gracePeriod = productTypes[product.productType].gracePeriod;
      return { productType, capacityReductionRatio, useFixedPrice, gracePeriod, isDeprecated };
    });
  };

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

  const fetchCoverCount = async () => cover.getCoverDataCount();

  const fetchCover = async coverId => {
    const [{ productId, coverAsset, amount, start, period }, { originalCoverId, latestCoverId }] =
      await cover.getCoverDataWithReference(coverId);

    const poolAllocations = (await cover.getPoolAllocations(coverId)).map(poolAllocation => {
      const { poolId, coverAmountInNXM, premiumInNXM, allocationId } = poolAllocation;
      return { poolId, coverAmountInNXM, premiumInNXM, allocationId };
    });

    return { productId, coverAsset, amount, start, period, originalCoverId, latestCoverId, poolAllocations };
  };

  const fetchCoverReference = async coverId => {
    const { originalCoverId, latestCoverId } = await cover.getCoverReference(coverId);
    return { originalCoverId, latestCoverId };
  };

  const fetchCoverPoolTrancheAllocations = async (coverId, poolId, allocationId) => {
    const stakingPool = contracts('StakingPool', poolId);
    console.info(`Fetching allocations for cover ${coverId} in pool ${poolId} at address ${stakingPool.address}`);

    const packedTrancheAllocation = await stakingPool.coverTrancheAllocations(allocationId);
    return packedTrancheAllocation;
  };

  // RiContracts
  const fetchVaultStake = async (vaultId, subnetworks = [], productId = null, riSubnetworks = {}) => {
    const operator = '0x51ad1265C8702c9e96Ea61Fe4088C2e22eD4418e';
    let maxWeightedStake = BigNumber.from(0);

    for (const subnetworkId of subnetworks) {
      const subnetworkStake = await riContracts[`delegator_${vaultId}`].stake(subnetworkId, operator);

      // Determine the weight to use for this subnetwork
      let weight = constants.RI_WEIGHT; // Default weight

      if (productId !== null && riSubnetworks && riSubnetworks[subnetworkId]) {
        const subnetwork = riSubnetworks[subnetworkId];
        // Check if this subnetwork contains the product
        if (subnetwork.products && subnetwork.products[String(productId)]) {
          weight = subnetwork.products[String(productId)].weight;
        }
      }

      // Calculate weighted stake for this subnetwork: stake * weight / 100
      const weightedStake = subnetworkStake.mul(weight).div(constants.RI_WEIGHT_DENOMINATOR);

      // Keep track of the maximum weighted stake across all subnetworks
      // This allows a subnetwork with lower stake but higher weight to win
      maxWeightedStake = weightedStake.gt(maxWeightedStake) ? weightedStake : maxWeightedStake;
    }

    return maxWeightedStake;
  };

  const fetchVaultWithdrawals = async vaultId => {
    console.log(riContracts[`vault_${vaultId}`].address);
    const currentEpoch = await riContracts[`vault_${vaultId}`].currentEpoch();
    const withdrawalAmount = await riContracts[`vault_${vaultId}`].withdrawals(currentEpoch + 1);
    return withdrawalAmount.mul(constants.RI_WEIGHT).div(constants.RI_WEIGHT_DENOMINATOR);
  };

  const fetchVaultAllocations = async blockNumber => {
    const events = await cover.queryFilter(cover.filters.CoverRiAllocated(), blockNumber);

    const allocations = {};
    for (const event of events) {
      const { args } = event;
      const { coverId, data, dataFormat } = args;

      const { start, period, productId, originalCoverId } = await fetchCover(coverId);
      const coverAllocations = defaultAbiCoder.decode([constants.RI_DATA_FORMATS[dataFormat]], [data]);

      for (const coverAllocation of coverAllocations) {
        const { amount, vaultId } = coverAllocation;
        if (!allocations[vaultId]) {
          allocations[`${productId}_${vaultId}`] = [];
        }

        allocations[`${productId}_${vaultId}`].push({
          amount,
          coverId,
          expiryTimestamp: start + period,
          originalCoverId,
        });
      }
    }

    return allocations;
  };

  const fetchVaultNextEpochStart = async vaultId => {
    return await riContracts[`vault_${vaultId}`].nextEpochStart();
  };

  const fetchRiAssetRate = async assetId => {
    return {
      assetRate: await riContracts[`asset_${assetId}`].getRate(),
      protocolAssetCorrelationId: riContracts[`asset_${assetId}`].protocolAssetCorrelationId,
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
    fetchVaultStake,
    fetchVaultWithdrawals,
    fetchVaultAllocations,
    fetchVaultNextEpochStart,
    fetchRiAssetRate,
  };
};

module.exports = createChainApi;
