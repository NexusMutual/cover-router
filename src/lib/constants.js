const ethers = require('ethers');

module.exports = {
  // TODO: update hash when new version is deployed
  INIT_CODE_HASH: '1eb804b66941a2e8465fa0951be9c8b855b7794ee05b0789ab22a02ee1298ebe',
  STAKING_POOL_STARTING_ID: 0,
  TRANCHE_DURATION: 7862400, // seconds
  SURGE_PRICE_RATIO: 2, // ether,
  SURGE_THRESHOLD_RATIO: 90, // 90.00%
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

  MIN_COVER_PERIOD: 2419200, // seconds
};
