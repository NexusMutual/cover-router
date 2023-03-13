const { ethers } = require('ethers');
const { WeiPerEther } = ethers.constants;

const createChainApi = async contracts => {
  // contract instances
  const cover = contracts('Cover');
  const pool = contracts('Pool');
  const stakingPoolFactory = contracts('StakingPoolFactory');
  const stakingProducts = contracts('StakingProducts');
  const stakingViewer = contracts('StakingViewer');

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
    const { productType, capacityReductionRatio, useFixedPrice } = await cover.products(id);
    const { gracePeriod } = await cover.productTypes(productType);
    return { productType, capacityReductionRatio, useFixedPrice, gracePeriod };
  };

  const fetchProducts = async () => {
    const products = await cover.getProducts();
    const productTypeCount = await cover.productTypesCount();
    const productTypes = [];

    for (let i = 0; i < productTypeCount; i++) {
      productTypes.push(await cover.productTypes(i));
    }

    return products.map((product, id) => {
      const { productType, capacityReductionRatio, useFixedPrice } = product;
      const gracePeriod = productTypes[product.productType].gracePeriod;
      return { productType, capacityReductionRatio, useFixedPrice, gracePeriod };
    });
  };

  const fetchPoolProduct = async (productId, poolId, globalCapacityRatio, capacityReductionRatio) => {
    const stakingPool = contracts('StakingPool', poolId);
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
