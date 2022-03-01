const EventEmitter = require('events');
const { instanceOf } = require('./initContracts');
const log = require('./log');
const { getPollingBlockEmitter } = require('./utils');

const allPoolPriceParameters = [];

let lastBlockNumber = 0;

async function fetchAllPoolPriceData() {
  const { provider, CO } = instanceOf;

  log.info('Fetching pool price data...');

  const stakingPoolCount = (await CO.stakingPoolCounter()).toNumber();
  log.info(`Fetching pool price data`);

  lastBlockNumber =  await provider.getBlockNumber();

  for (let i = 0; i < stakingPoolCount; i++) {
    log.info(`Fetching pool price parameters for pool ${i}`);
    const parameters = await CO.getPoolAllocationPriceParameters(i);
    allPoolPriceParameters.push(parameters);
  }
}

async function initializePoolPriceData() {
  await fetchAllPoolPriceData();

  const { provider, CO } = instanceOf;

  const pollingBlockEmitter = await getPollingBlockEmitter(provider);

  pollingBlockEmitter.on('async', async (blockNumber) => {
    if (blockNumber.gt(lastBlockNumber)) {

      log.info(`Processing block ${blockNumber.toString()}`);

      await getPoolAllocationPriceParametersForCoverActionEvents('CoverBought', blockNumber, CO);
      await getPoolAllocationPriceParametersForCoverActionEvents('CoverEdited', blockNumber, CO);

      // TODO: add event handling for staking and weight adjustment on pools.

      lastBlockNumber = blockNumber;
    }
  });
}

async function getPoolAllocationPriceParametersForCoverActionEvents(eventName, blockNumber, CO) {
  const filter = CO.filters[eventName]();
  filter.fromBlock = blockNumber;
  log.info(`Getting ${eventName} events`, {
    fromBlock: filter.fromBlock,
  });
  const logs = await provider.getLogs(filter);
  log.info(`Found ${logs.length} events`);
  const parsedLogs = logs.map(CO.interface.parseLog);

  for (const log of parsedLogs) {
    const { coverId, productId, segmentId } = log.args;

    const { poolId } = await CO.coverSegmentAllocations(coverId, segmentId);
    const poolAllocationPriceParameters = await CO.getPoolAllocationPriceParametersForProduct(poolId, productId);

    allPoolPriceParameters[poolId.toNumber()][productId.toNumber()] = poolAllocationPriceParameters;
  }
}

function getPools(productId) {

  const pools = [];
  for (let i = 0 ; i < allPoolPriceParameters.length; i++) {
    const poolPriceParametersForProduct = allPoolPriceParameters[i][productId];
    pools.push({ ...poolPriceParametersForProduct, poolId  });
  }

  return pools;
}

module.exports = {
  fetchAllPoolPriceData,
  initializePoolPriceData,
  getPools
}
