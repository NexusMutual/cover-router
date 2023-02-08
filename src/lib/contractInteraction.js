const { ethers } = require('ethers');
const constants = require('./constants');
const StakingPoolFactoryAbi = require('../contracts/StakingPoolFactory.json');
const StakingPoolAbi = require('../contracts/StakingPool.json');
const CoverAbi = require('../contracts/Cover.json');
const StakingViewerAbi = require('../contracts/StakingViewer.json');

const { BigNumber } = ethers;
const { getCreate2Address } = ethers.utils;
const { INIT_CODE_HASH, CONTRACTS_ADDRESSES, STAKING_POOL_STARTING_ID } = constants;
const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/');

function calculateCurrentTrancheId() {
  return Math.floor(Date.now() / (constants.TRANCHE_DURATION_DAYS * 24 * 3600 * 1000));
}
async function fetchStakingPools() {
  const StakingPoolFactory = new ethers.Contract(
    CONTRACTS_ADDRESSES.StakingPoolFactory,
    StakingPoolFactoryAbi,
    provider,
  );

  const count = await StakingPoolFactory.stakingPoolCount();

  const pools = [];
  for (let id = STAKING_POOL_STARTING_ID; id < STAKING_POOL_STARTING_ID + Number(count); id += 1) {
    const salt = Buffer.from(id.toString(16).padStart(64, '0'), 'hex');
    const initCodeHash = Buffer.from(INIT_CODE_HASH, 'hex');
    const address = getCreate2Address(CONTRACTS_ADDRESSES.StakingPoolFactory, salt, initCodeHash);
    pools.push({ id, address });
  }
  return pools;
}

async function fetchStakingPoolData() {
  const pools = await fetchStakingPools();

  const stakingPools = {};
  for (const pool of pools) {
    const StakingPool = new ethers.Contract(pool.address, StakingPoolAbi, provider);

    const currentTrancheId = calculateCurrentTrancheId();
    const deposits = await StakingPool.queryFilter('StakeDeposited');
    const depositsPerTranche = deposits.reduce((acc, { args }) => {
      const [, amount, tranchId] = args;
      const key = tranchId.toString();
      if (tranchId.lt(currentTrancheId)) {
        return acc;
      }
      if (!acc[key]) {
        acc[key] = BigNumber.from(0);
      }
      acc[key] = acc.add(amount);
      return acc;
    }, {});

    const withdrawals = await StakingPool.queryFilter('Withdraw');
    const withdrawalsPerTranche = withdrawals.reduce((acc, { args }) => {
      const [, , tranchId, amount] = args;
      const key = tranchId.toString();
      if (!acc[key]) {
        acc[key] = BigNumber.from(0);
      }
      acc[key] = acc.add(amount);
      return acc;
    }, {});
    const allocations = await StakingPool.getActiveAllocations();
    const allocationsPerTranche = allocations.reduce((acc, amount, i) => {
      acc[currentTrancheId + 1] = amount;
      return acc;
    }, {});
    stakingPools[pool.address] = {
      depositsPerTranche,
      withdrawalsPerTranche,
      allocationsPerTranche,
    };
    for (let i = currentTrancheId; i <= currentTrancheId + 8; i += 1) {
      stakingPools[pool.address].capacityPerTranche = depositsPerTranche[i]
        .sub(withdrawalsPerTranche[i])
        .sub(allocationsPerTranche[i]);
    }
  }
}

async function fetchAllProducts() {
  const Cover = new ethers.Contract(CONTRACTS_ADDRESSES.Cover, CoverAbi, provider);
  const allProducts = await Cover.getProducts();
  const productDates = await fetchProductLatestPurchaseDate();
  return allProducts.reduce((acc, product) => {
    acc[product.id] = {
      lastPurchase: productDates[product.id],
      ...product,
    };
    return acc;
  }, {});
}

async function fetchAllCovers() {
  const Cover = new ethers.Contract(CONTRACTS_ADDRESSES.Cover, CoverAbi, provider);
  const StakingViewer = new ethers.Contract(CONTRACTS_ADDRESSES.StakingViewer, StakingViewerAbi, provider);

  const coverCount = Cover.coverDataCount();
  return await StakingViewer.getCovers([...Array(coverCount.toNumber()).keys()]);
}

async function fetchProductLatestPurchaseDate() {
  const covers = await fetchAllCovers();
  return covers.reduce((acc, cover) => {
    if (!acc[cover.productId]) {
      acc[cover.productId] = cover.coverStart;
    } else if (cover.coverStart > acc[cover.productId]) {
      acc[cover.productId] = cover.coverStart;
    }
    return acc;
  }, {});
}
