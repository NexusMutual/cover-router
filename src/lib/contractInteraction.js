const { ethers } = require('ethers');
const constants = require('./constants');
const StakingPoolFactoryAbi = require('../contracts/StakingPoolFactory.json');
const StakingPoolAbi = require('../contracts/StakingPool.json');
const CoverAbi = require('../contracts/Cover.json');
const StakingViewerAbi = require('../contracts/StakingViewer.json');

const { getCreate2Address } = ethers.utils;
const { INIT_CODE_HASH, CONTRACTS_ADDRESSES, STAKING_POOL_STARTING_ID } = constants;
const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/');
const wsProvider = new ethers.providers.WebSocketProvider(process.env.WS_URL);

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
    const address = calculateAddress(pool.poolId);
    const StakingPool = new ethers.Contract(address, StakingPoolAbi, provider);
    const { trancheCapacities } = await StakingPool.getActiveTrancheCapacities(
      id,
      globalCapacityRatio,
      capacityReductionRatio,
    );
    productData[pool.poolId] = {
      trancheCapacities,
      blockNumber: latestBlockNumber,
    };
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
    stakingPoolProducts.push({...data, productId})
  }
}

async function fetchProductDataForPool(productId, poolId) {
  const address = calculateAddress(poolId);
  const Cover = new ethers.Contract(CONTRACTS_ADDRESSES.Cover, CoverAbi, provider);
  const StakingPool = new ethers.Contract(address, StakingPoolAbi, provider);

  const latestBlockNumber = await provider.getBlockNumber();
  const { capacityReductionRatio } = await Cover.products(productId);
  const globalCapacityRatio = await Cover.globalCapacityRatio();

  const { trancheCapacities } = await StakingPool.getActiveTrancheCapacities(
      productId,
      globalCapacityRatio,
      capacityReductionRatio,
      {
        blockTag: latestBlockNumber
      },
  );
  return {
    trancheCapacities,
    blockNumber: latestBlockNumber,
  }
}

module.exports = {
  calculateAddress,
  fetchStakingPoolIdAndAddress,
  fetchStakingPoolsData,
  fetchStakingPoolDataById,
  fetchAllProductsData,
  fetchProductDataById,
  fetchProductDataForPool,
  fetchAllProductDataForPool
};
