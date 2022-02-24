const { instanceOf } = require('./initContracts');

const poolPriceParameters = [];

async function fetchAllPoolPriceData() {
  const { provider, CO } = instanceOf;

  const stakingPoolCount = (await CO.stakingPoolCounter()).toNumber();
  const productsCount = (await CO.productsCount()).toNumber()

  for (let i = 0; i < stakingPoolCount; i++) {
    console.log(`Fetching pool price parameters for pool ${i}`);
    const parameters = await CO.getPoolAllocationPriceParameters(i);
    poolPriceParameters.push(parameters);
  }
}

module.exports = {
  fetchAllPoolPriceData,
  poolPriceParameters,
}
