const EventEmitter = require('events');
const { ethers } = require('ethers');
const config = require('../config');

const constants = require('./constants');
const contractAddresses = require('./contracts.json');
const { calculateCurrentTrancheId } = require('./helpers');

const StakingPoolFactoryAbi = require('../abis/StakingPoolFactory.json');
const StakingPoolAbi = require('../abis/StakingPool.json');
const CoverAbi = require('../abis/Cover.json');
const StakingViewerAbi = require('../abis/StakingViewer.json');
const StakingProductAbi = require('../abis/StakingProducts.json');
const PoolAbi = require('../abis/Pool.json');

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
  const contractAddressesPath = config.get('contractsPath');
  const { CONTRACTS_ADDRESSES: contractAddresses } = require(contractAddressesPath);

  const stakingPoolFactory = new ethers.Contract(contractAddresses.StakingPoolFactory, StakingPoolFactoryAbi, provider);
  const cover = new ethers.Contract(contractAddresses.Cover, CoverAbi, provider);
  const stakingViewer = new ethers.Contract(contractAddresses.StakingViewer, StakingViewerAbi, provider);
  const stakingProducts = new ethers.Contract(contractAddresses.StakingProducts, StakingProductAbi, provider);
  const pool = new ethers.Contract(contractAddresses.Pool, PoolAbi, provider);

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

    // console.log('PRODUCT', product);
    // console.log('PRODUCT ID', productId);

    const { trancheCapacities } = await stakingPool.getActiveTrancheCapacities(
      productId,
      globalCapacityRatio,
      capacityReductionRatio,
    );

    // console.log('TRANCHE CAPACITIES', trancheCapacities);

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
    return pools.map(({ poolId }) => poolId.toNumber());
  }

  async function fetchCurrencyRate(assetId) {
    return pool.getTokenPriceInAsset(assetId);
  }

  // listeners
  function initiateListener(stakingPoolCount) {
    const emitter = new EventEmitter();
    const trancheId = calculateCurrentTrancheId();

    function trancheCheck() {
      const activeTrancheId = calculateCurrentTrancheId();
      if (activeTrancheId !== trancheId) {
        emitter.emit('tranche:change');
      }
      setTimeout(trancheCheck, 1000);
    }

    // listen events for all existing pools
    for (let poolId = 1; poolId <= stakingPoolCount; poolId++) {
      const address = calculateAddress(poolId);
      const contract = new ethers.Contract(address, StakingPoolAbi, provider);

      contract.on({ topics }, () => emitter.emit('pool:changed', poolId));
    }

    // listen for new staking pool
    stakingPoolFactory.on('StakingPoolCreated', async (id, address) => {
      emitter.emit('pool:change', id);
      const contract = new ethers.Contract(address, StakingPoolAbi, provider);
      contract.on({ topics }, () => emitter.emit('pool:change', id));
    });

    // listen for cover events
    cover.on('ProductSet', productId => emitter.emit('product:change', productId));
    cover.on('CoverEdited', (coverId, productId) => emitter.emit('product:change', productId));

    trancheCheck();

    return emitter;
  }

  return {
    fetchProducts,
    fetchProduct,
    fetchProductPools,
    fetchPoolsProducts,
    fetchGlobalCapacityRatio,
    fetchStakingPoolCount,
    fetchProductDataForPool,
    fetchCurrencyRate,
    initiateListener,
  };
};
