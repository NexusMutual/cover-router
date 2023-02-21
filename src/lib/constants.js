const ethers = require('ethers');

module.exports = {
  // TODO: update hash
  INIT_CODE_HASH: '203b477dc328f1ceb7187b20e5b1b0f0bc871114ada7e9020c9ac112bbfb6920',
  STAKING_POOL_STARTING_ID: 0,
  // TODO: no days
  TRANCHE_DURATION_DAYS: 91,
  SURGE_PRICE_RATIO: 2, // ether,
  SURGE_THRESHOLD_RATIO: 0.9, // 90.00%
  SURGE_THRESHOLD_DENOMINATOR: 100, // 100.00%
  // base price bump
  // +0.2% for each 1% of capacity used, ie +20% for 100%
  PRICE_BUMP_RATIO: 20_00, // 20%
  // bumped price smoothing
  // 0.5% per day
  PRICE_CHANGE_PER_DAY: 50, // 0.5%
  INITIAL_PRICE_DENOMINATOR: 100_00,
  TARGET_PRICE_DENOMINATOR: 100_00,
  MAX_TOTAL_WEIGHT: 20_00, // 20x

  MAX_ACTIVE_TRANCHES: 8, // 7 whole quarters + 1 partial quarter
  WEIGHT_DENOMINATOR: 100,
  ONE_NXM: ethers.utils.parseEther('1'),
  ALLOCATION_UNITS_PER_NXM: 100,

  NXM_PER_ALLOCATION_UNIT: ethers.utils.parseEther('1').div(100),

  // TODO: no days
  MIN_COVER_PERIOD: 28, // days

  ASSET_ID: {
    ETH: 0,
    DAI: 1,
  },
};
