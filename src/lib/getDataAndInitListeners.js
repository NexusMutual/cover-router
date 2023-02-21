const { ethers } = require('ethers');
const { actions } = require('../store');
const config = require('../config');
const {
  calculateCurrentTrancheId,
  fetchStakingPoolsData,
  fetchStakingPoolDataById,
  fetchAllProductsData,
  fetchProductDataById,
  fetchStakingPoolIdAndAddress,
  fetchProductDataForPool,
  fetchAllProductDataForPool,
} = require('../contract/helpers');

const StakingPoolAbi = require('../abis/StakingPool.json');
const StakingPoolFactoryAbi = require('../abis/StakingPoolFactory.json');
const CoverAbi = require('../abis/Cover.json');

const { CONTRACTS_ADDRESSES } = require('./constants');

const url = config.get('provider.ws');
const wsProvider = new ethers.providers.WebSocketProvider(url);

const stakingPoolContracts = [];
let trancheId;
let store;

async function fetchInitialData() {
  const stakingPools = await fetchStakingPoolsData();
  const products = await fetchAllProductsData();
  store.dispatch({
    type: actions.SET_STATE,
    payload: {
      products,
      stakingPools,
    },
  });
  console.info('Initial Data set');
}

async function fetchStakingPoolData(id) {
  const poolData = await fetchStakingPoolDataById(id);

  store.dispatch({
    type: actions.ADD_STAKING_POOL,
    payload: { id, poolData },
  });
}

async function updateProductsByStakingPool(poolId) {
  const { products } = store.getState();
  const stakingPoolProducts = Object.values(products).reduce((acc, [productId, stakingPools = []]) => {
    if (Object.keys(stakingPools).includes(poolId)) {
      acc.push(productId);
    }
    return acc;
  }, []);
  for (const productId of stakingPoolProducts) {
    const stakingPoolData = fetchProductDataForPool(productId, poolId);
    store.dispatch({
      type: actions.SET_PRODUCT_STAKING_POOL,
      payload: {
        productId,
        poolId,
        stakingPoolData,
      },
    });
  }
}

function subscribeToStakingPoolDependantEvents(poolId, address) {
  const contract = new ethers.Contract(address, StakingPoolAbi, wsProvider);

  // todo: group as a single filter
  contract.on('StakeBurned', () => updateProductsByStakingPool(poolId));
  contract.on('DepositExtended', () => updateProductsByStakingPool(poolId));
  contract.on('StakeDeposited', () => updateProductsByStakingPool(poolId));
  contract.on('PoolFeeChanged', () => updateProductsByStakingPool(poolId));
  contract.on('StakeBurned', () => updateProductsByStakingPool(poolId));

  // todo: remove
  stakingPoolContracts.push(contract);
}

async function subscribeToAllStakingPoolDependantEvents() {
  const stakingPools = await fetchStakingPoolIdAndAddress();

  for (const pool of stakingPools) {
    const { address, id } = pool;
    subscribeToStakingPoolDependantEvents(id, address);
  }
}

async function subscribeToPoolAllocationChanges() {
  const stakingPools = await fetchStakingPoolIdAndAddress();

  for (const pool of stakingPools) {
    const { address, id } = pool;
    subscribeToStakingPoolDependantEvents(id, address);
  }
}

async function subscribeToCoverEvents() {
  const Cover = new ethers.Contract(CONTRACTS_ADDRESSES.Cover, CoverAbi, wsProvider);

  Cover.on('ProductSet', productId => fetchProductDataById(productId));
  Cover.on('CoverEdited', (coverId, productId) => fetchProductDataById(productId));

  // TODO: add global capacity factor listener
}

async function subscribeToNewStakingPools() {
  const StakingPoolFactory = new ethers.Contract(
    CONTRACTS_ADDRESSES.StakingPoolFactory,
    StakingPoolFactoryAbi,
    wsProvider,
  );

  StakingPoolFactory.on('StakingPoolCreated', async (id, address) => {
    await fetchStakingPoolData(id);
    const productsData = await fetchAllProductDataForPool(id);
    for (const product of productsData) {
      const { productId, trancheCapacities, blockNumber } = product;
      store.dispatch({
        type: actions.SET_PRODUCT_STAKING_POOL,
        payload: {
          productId,
          poolId: id,
          stakingPoolData: {
            trancheCapacities,
            blockNumber,
          },
        },
      });
    }
    subscribeToStakingPoolDependantEvents(id, address);
  });
}

module.exports = async function (app) {
  // TODO: pass the store directly
  store = app.get('store');
  // initialization check not needed
  if (!store) {
    throw Error('Store not initialized');
  }

  await fetchInitialData();

  // tranche expiration checker
  // TODO: make sure only one runs at a time
  // TODO: consider using setTimeout
  const trancheChecker = setInterval(async () => {
    const activeTrancheId = calculateCurrentTrancheId();
    // TODO !==
    if (activeTrancheId === trancheId) {
      await fetchAllProductsData();
    }
  }, 10000);

  // subscribe to Pool events
  await subscribeToAllStakingPoolDependantEvents();
  await subscribeToNewStakingPools();

  await subscribeToPoolAllocationChanges();

  // subscribe to Cover Events
  await subscribeToCoverEvents();

  // TODO: redundant
  process.on('SIGTERM', () => {
    for (const contract of stakingPoolContracts) {
      contract.removeAllListeners();
    }
    clearInterval(trancheChecker);
  });
};
