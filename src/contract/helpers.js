const { ethers } = require('ethers');
const config = require('../config');
const constants = require('../lib/constants');
const StakingPoolFactoryAbi = require('../abis/StakingPoolFactory.json');
const StakingPoolAbi = require('../abis/StakingPool.json');
const CoverAbi = require('../abis/Cover.json');
const StakingViewerAbi = require('../abis/StakingViewer.json');
const StakingProductAbi = require('../abis/StakingProducts.json');

const { getCreate2Address } = ethers.utils;
const { INIT_CODE_HASH, CONTRACTS_ADDRESSES, STAKING_POOL_STARTING_ID } = constants;
const url = config.get('provider.http');
const provider = new ethers.providers.JsonRpcProvider(url);

function calculateCurrentTrancheId() {
  return Math.floor(Date.now() / (constants.TRANCHE_DURATION_DAYS * 24 * 3600 * 1000));
}

function calculateAddress(id) {
  const salt = Buffer.from(id.toString(16).padStart(64, '0'), 'hex');
  const initCodeHash = Buffer.from(INIT_CODE_HASH, 'hex');
  return getCreate2Address(CONTRACTS_ADDRESSES.StakingPoolFactory, salt, initCodeHash);
}

/* ================== STAKING POOLS ================================== */

// example
// const dataFetchers = async provider => {
//   // initialize contract instances at the top except staking pools
//
//   const fetchStakingPoolIdAndAddress = async () => {};
//
//   const fetchStakingPoolsData = async () => {};
//
//   return {
//     fetchStakingPoolIdAndAddress,
//     fetchStakingPoolsData,
//   };
// };
//
// module.exports = dataFetcherFactory;

// TODO: probably not needed anymore
async function fetchStakingPoolIdAndAddress() {
  const StakingPoolFactory = new ethers.Contract(
    CONTRACTS_ADDRESSES.StakingPoolFactory,
    StakingPoolFactoryAbi,
    provider,
  );

  const count = await StakingPoolFactory.stakingPoolCount();

  const pools = [];
  for (let id = STAKING_POOL_STARTING_ID; id < STAKING_POOL_STARTING_ID + Number(count); id += 1) {
    const address = calculateAddress(id);
    // TODO: address does not seem to be used anywhere
    pools.push({ id, address });
  }
  return pools;
}

async function fetchStakingPoolsData() {
  const StakingViewer = new ethers.Contract(CONTRACTS_ADDRESSES.StakingViewer, StakingViewerAbi, provider);
  const pools = await StakingViewer.getAllPools();
  return pools.reduce((acc, pool) => {
    acc[pool.poolId.toString()] = pool;
    return acc;
  }, {});
}

async function fetchStakingPoolDataById(id) {
  // TODO: use lowercase for all contract instances
  const StakingViewer = new ethers.Contract(CONTRACTS_ADDRESSES.StakingViewer, StakingViewerAbi, provider);

  return StakingViewer.getPool(id);
}

/* ================== PRODUCTS ================================== */

async function fetchProductPools(productId) {
  const StakingViewer = new ethers.Contract(CONTRACTS_ADDRESSES.StakingViewer, StakingViewerAbi, provider);
  const pools = await StakingViewer.getProductPools(productId);
  return pools.map(({ id }) => id);
}

async function fetchCoverProducts() {
  const Cover = new ethers.Contract(CONTRACTS_ADDRESSES.Cover, CoverAbi, provider);
  return await Cover.getProducts();
}

async function fetchAllProductDataForPool(poolId) {
  const StakingViewer = new ethers.Contract(CONTRACTS_ADDRESSES.StakingViewer, StakingViewerAbi, provider);

  const products = StakingViewer.getPoolProducts(poolId);
  const stakingPoolProducts = [];
  for (const { productId } of products) {
    const data = await fetchProductDataForPool(productId, poolId);
    stakingPoolProducts.push({ ...data, productId });
  }
  return stakingPoolProducts;
}

async function fetchProductDataForPool(productId, poolId, capacityReductionRatio, globalCapacityRatio) {
  const address = calculateAddress(poolId);
  const StakingPool = new ethers.Contract(address, StakingPoolAbi, provider);
  const StakingProducts = new ethers.Contract(CONTRACTS_ADDRESSES.StakingProducts, StakingProductAbi, provider);

  const product = await StakingProducts.getProduct(poolId, productId);

  const { trancheCapacities } = await StakingPool.getActiveTrancheCapacities(
    productId,
    globalCapacityRatio,
    capacityReductionRatio,
  );

  const allocations = await StakingPool.getActiveAllocations(productId);

  return {
    ...product,
    trancheCapacities,
    allocations,
  };
}

module.exports = {
  calculateCurrentTrancheId,
  calculateAddress,
  fetchStakingPoolIdAndAddress,
  fetchStakingPoolsData,
  fetchStakingPoolDataById,
  fetchAllProductsData,
  fetchProductDataById,
  fetchProductDataForPool,
  fetchAllProductDataForPool,
};
