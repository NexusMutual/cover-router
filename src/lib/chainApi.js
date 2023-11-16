const { ethers } = require('ethers');
const { WeiPerEther } = ethers.constants;

const createChainApi = async contracts => {
  // contract instances
  const cover = contracts('Cover');
  const pool = contracts('Pool');
  const stakingPoolFactory = contracts('StakingPoolFactory');
  const stakingProducts = contracts('StakingProducts');
  const stakingViewer = contracts('StakingViewer');
  const coverViewer = contracts('CoverViewer');

  const fetchTokenPriceInAsset = async assetId => {
    return assetId === 255 ? WeiPerEther : pool.getTokenPriceInAsset(assetId);
  };

  const fetchGlobalCapacityRatio = async () => cover.globalCapacityRatio();

  const fetchStakingPoolCount = async () => stakingPoolFactory.stakingPoolCount();

  const fetchProductCount = async () => cover.productsCount();

  const fetchPoolProductIds = async poolId => {
    const products = await stakingViewer.getPoolProducts(poolId);
    return products.map(product => product.productId.toNumber());
  };

  const fetchProductPoolsIds = async productId => {
    const pools = await stakingViewer.getProductPools(productId);
    return pools.map(pool => pool.poolId.toNumber());
  };

  const fetchProduct = async id => {
    const { productType, capacityReductionRatio, useFixedPrice, isDeprecated } = await cover.products(id);
    const { gracePeriod } = await cover.productTypes(productType);
    return { productType, capacityReductionRatio, useFixedPrice, gracePeriod, isDeprecated };
  };

  const fetchProducts = async () => {
    const products = await cover.getProducts();
    const productTypeCount = await cover.productTypesCount();
    const productTypes = [];

    for (let i = 0; i < productTypeCount; i++) {
      productTypes.push(await cover.productTypes(i));
    }

    return products.map((product, id) => {
      const { productType, capacityReductionRatio, useFixedPrice, isDeprecated } = product;
      const gracePeriod = productTypes[product.productType].gracePeriod;
      return { productType, capacityReductionRatio, useFixedPrice, gracePeriod, isDeprecated };
    });
  };

  const fetchCovers = async (coverIds) => {

    const { covers, lastSegmentAllocations } = await coverViewer.getCoversWithLastSegmentAllocations(coverIds);

    // lastSegmentAllocations is a mapping from poolId to aLlocation
    cover.lastSegmentAllocations = {};
    for (let i = 0; i < covers.length; i++) {
      const cover = covers[i];
      cover.lastSegmentAllocations[lastSegmentAllocations[i].poolId] = lastSegmentAllocations[i];
    }
    return covers;
  }

  const fetchCover = async (coverId) => {
    const cover = await coverViewer.getCovers([coverId]);
    return cover;
  }

  function fetchCoverCount = async () => {
    const coverDataCount = await cover.coverDataCount();
    return coverDataCount;
  }

  const fetchPoolProduct = async (productId, poolId, globalCapacityRatio, capacityReductionRatio) => {
    consst stakingPool = contracts('StakingPool', poolId);
    console.log('Fetching allocations for product', productId, 'in pool', poolId, 'at address', stakingPool.address);

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

  return {
    fetchCovers,
    fetchCover,
    fetchCoverCount,
    fetchProducts,
    fetchProduct,
    fetchProductPoolsIds,
    fetchPoolProductIds,
    fetchGlobalCapacityRatio,
    fetchStakingPoolCount,
    fetchProductCount,
    fetchPoolProduct,
    fetchTokenPriceInAsset,
  };
};

module.exports = createChainApi;
