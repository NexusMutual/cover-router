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
    pools.push({ id, address });
  }
  return pools;
}

async function fetchStakingPoolsData() {
  const StakingViewer = new ethers.Contract(CONTRACTS_ADDRESSES.StakingViewer, StakingViewerAbi, provider);
  const pools = await StakingViewer.getAllPools();
  return pools.reduce((acc, pool) => {
    acc[pool.poolId] = pool;
    return acc;
  }, {});
}

async function fetchStakingPoolDataById(id) {
  const StakingViewer = new ethers.Contract(CONTRACTS_ADDRESSES.StakingViewer, StakingViewerAbi, provider);

  return StakingViewer.getPool(id);
}

/* ================== PRODUCTS ================================== */

async function fetchProductDataById(id, globalCapacityRatio) {
  const StakingViewer = new ethers.Contract(CONTRACTS_ADDRESSES.StakingViewer, StakingViewerAbi, provider);
  const Cover = new ethers.Contract(CONTRACTS_ADDRESSES.Cover, CoverAbi, provider);

  if (!globalCapacityRatio) {
    globalCapacityRatio = await Cover.globalCapacityRatio();
  }
  const pools = StakingViewer.getProductPools(id);
  const { capacityReductionRatio } = await Cover.products(id);
  const latestBlockNumber = await provider.getBlockNumber();
  const productData = {};

  for (const pool of pools) {
    productData[pool.poolId] = await fetchProductDataForPool(id, pool.poolId, {
      globalCapacityRatio,
      capacityReductionRatio,
      latestBlockNumber,
    });
  }
  return productData;
}

async function fetchAllProductsData() {
  const Cover = new ethers.Contract(CONTRACTS_ADDRESSES.Cover, CoverAbi, provider);

  const globalCapacityRatio = await Cover.globalCapacityRatio();
  const products = await Cover.getProducts();
  const productsData = {};

  for (const product of products) {
    productsData[product.productId] = await fetchProductDataById(product.productId, globalCapacityRatio);
  }
  return productsData;
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

async function fetchProductDataForPool(
  productId,
  poolId,
  { latestBlockNumber, capacityReductionRatio, globalCapacityRatio } = {},
) {
  const address = calculateAddress(poolId);
  const Cover = new ethers.Contract(CONTRACTS_ADDRESSES.Cover, CoverAbi, provider);
  const StakingPool = new ethers.Contract(address, StakingPoolAbi, provider);
  const StakingProducts = new ethers.Contract(CONTRACTS_ADDRESSES.StakingProducts, StakingProductAbi, provider);

  if (!latestBlockNumber) {
    latestBlockNumber = await provider.getBlockNumber();
  }
  if (!capacityReductionRatio) {
    const product = await Cover.products(productId);
    capacityReductionRatio = product.capacityReductionRatio;
  }
  if (!globalCapacityRatio) {
    globalCapacityRatio = await Cover.globalCapacityRatio();
  }
  const product = await StakingProducts.getProduct(poolId, productId);

  const { trancheCapacities } = await StakingPool.getActiveTrancheCapacities(
    productId,
    globalCapacityRatio,
    capacityReductionRatio,
    {
      blockTag: latestBlockNumber,
    },
  );
  const allocations = await StakingPool.getActiveAllocations(productId);

  return {
    ...product,
    trancheCapacities,
    allocations,
    blockNumber: latestBlockNumber,
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
