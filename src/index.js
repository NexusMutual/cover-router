const { ethers } = require('ethers');
const { store, actions } = require('./store');
const {
  fetchStakingPoolsData,
  fetchStakingPoolDataById,
  fetchAllProductsData,
  fetchProductDataById,
  fetchStakingPoolIdAndAddress,
  fetchProductDataForPool,
  fetchAllProductDataForPool
} = require('./lib/contractInteraction');
const StakingPoolAbi = require("../contracts/StakingPool.json");
const CoverAbi = require("../contracts/Cover.json");
const StakingPoolFactoryAbi = require("../contracts/StakingPoolFactory.json");
const constants = require("./constants");

const { CONTRACTS_ADDRESSES } = constants;

const wsProvider = new ethers.providers.WebSocketProvider(process.env.WS_URL);

const stakingPoolContracts = [];

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
  const state = store.getState();
  console.log(state);
}

async function fetchProduct(id) {
  const productData = await fetchProductDataById(id);

  store.dispatch({
    type: actions.ADD_PRODUCT,
    payload: { id, productData },
  });
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
        stakingPoolData
      }
    })
  }
}

function subscribeToStakingPoolDependantEvents(poolId, address) {
  const contract = new ethers.Contract(address, StakingPoolAbi, wsProvider);

  contract.on('StakeBurned', () => updateProductsByStakingPool(id));
  contract.on('DepositExtended', () => updateProductsByStakingPool(id));
  contract.on('StakeDeposited', () => updateProductsByStakingPool(id));
  contract.on('PoolFeeChanged', () => updateProductsByStakingPool(id));

  stakingPoolContracts.push(contract);
}

async function subscribeToAllStakingPoolDependantEvents() {
  const stakingPools = await fetchStakingPoolIdAndAddress();

  for (const pool of stakingPools) {
    const { address, id } = pool;
    subscribeToStakingPoolDependantEvents(id, address)
  }
}

async function subscribeToNewStakingPools() {
  const StakingPoolFactory = new ethers.Contract(CONTRACTS_ADDRESSES.StakingPoolFactory, StakingPoolFactoryAbi, wsProvider);

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
          }
        }
      })
    }
    subscribeToStakingPoolDependantEvents(id, address);
  });

}

subscribeToAllStakingPoolDependantEvents();
subscribeToNewStakingPools();

process.on('SIGTERM', () => {
  for (const contract of poolContracts) {
    contract.removeAllListeners();
  }
});
