const { ethers } = require('ethers');

const constants = require('./constants');
const contractAddresses = require('./contracts.json');

const StakingPoolFactoryAbi = require('../abis/StakingPoolFactory.json');
const StakingPoolAbi = require('../abis/StakingPool.json');
const CoverAbi = require('../abis/Cover.json');
const StakingViewerAbi = require('../abis/StakingViewer.json');
const StakingProductAbi = require('../abis/StakingProducts.json');

const { getCreate2Address } = ethers.utils;
const { INIT_CODE_HASH } = constants;

function calculateAddress(id) {
  const salt = Buffer.from(id.toString(16).padStart(64, '0'), 'hex');
  const initCodeHash = Buffer.from(INIT_CODE_HASH, 'hex');
  return getCreate2Address(contractAddresses.StakingPoolFactory, salt, initCodeHash);
}

const topics = [
  [
    'StakeBurned(uint)',
    'DepositExtended(address,uint256,uint256,uint256,uint256)',
    'StakeDeposited(address,uint256,uint256,uint256)',
    'PoolFeeChanged(address,uint)',
  ].map(event => ethers.utils.id(event)),
];

module.exports = provider => {
  // initiate contracts
  const stakingPoolFactory = new ethers.Contract(contractAddresses.StakingPoolFactory, StakingPoolFactoryAbi, provider);
  const cover = new ethers.Contract(contractAddresses.Cover, CoverAbi, provider);
  const stakingViewer = new ethers.Contract(contractAddresses.StakingViewer, StakingViewerAbi, provider);
  const stakingProducts = new ethers.Contract(contractAddresses.StakingProducts, StakingProductAbi, provider);

  async function fetchGlobalCapacityRatio() {
    return cover.globalCapacityRatio();
  }

  async function fetchStakingPoolCount() {
    return stakingPoolFactory.stakingPoolCount();
  }

  async function fetchPoolsProducts(poolId) {
    const products = await stakingViewer.getPoolProducts(poolId);
    return products.map(({ productId }) => productId);
  }

  async function fetchProductDataForPool(productId, poolId, capacityReductionRatio, globalCapacityRatio) {
    const address = calculateAddress(poolId);
    const stakingPool = new ethers.Contract(address, StakingPoolAbi, provider);

    const product = await stakingProducts.getProduct(poolId, productId);

    const { trancheCapacities } = await stakingPool.getActiveTrancheCapacities(
      productId,
      globalCapacityRatio,
      capacityReductionRatio,
    );

    const allocations = await stakingPool.getActiveAllocations(productId);

    return {
      ...product,
      trancheCapacities,
      allocations,
    };
  }

  async function fetchProducts() {
    return await cover.getProducts();
  }

  async function fetchProduct(id) {
    return await cover.products(id);
  }

  async function fetchProductPools(productId) {
    const pools = await stakingViewer.getProductPools(productId);
    return pools.map(({ id }) => id);
  }

  // listeners
  function subscribeToAllStakingPoolDependantEvents(stakingPoolCount, cb) {
    for (let poolId = 1; poolId <= stakingPoolCount; poolId++) {
      const address = calculateAddress(poolId);
      const contract = new ethers.Contract(address, StakingPoolAbi, provider);

      contract.on({ topics }, () => cb(poolId));
    }
  }

  function subscribeToNewStakingPools(cb) {
    stakingPoolFactory.on('StakingPoolCreated', async (id, address) => {
      await cb(id);
      const contract = new ethers.Contract(address, StakingPoolAbi, provider);
      contract.on({ topics }, () => cb(id));
    });
  }

  function subscribeToCoverEvents(cb) {
    cover.on('ProductSet', cb);
    cover.on('CoverEdited', (coverId, productId) => cb(productId));
  }

  return {
    fetchProducts,
    fetchProduct,
    fetchProductPools,
    fetchPoolsProducts,
    fetchGlobalCapacityRatio,
    fetchStakingPoolCount,
    fetchProductDataForPool,

    subscribeToAllStakingPoolDependantEvents,
    subscribeToNewStakingPools,
    subscribeToCoverEvents,
  };
};
