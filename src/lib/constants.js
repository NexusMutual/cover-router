const { BigNumber, ethers } = require('ethers');
const { parseEther } = ethers.utils;

module.exports = {
  BEACON_PROXY_INIT_CODE_HASH: '1eb804b66941a2e8465fa0951be9c8b855b7794ee05b0789ab22a02ee1298ebe',
  TRANCHE_DURATION: 91 * 24 * 3600, // 91 days in seconds
  BUCKET_DURATION: 28 * 24 * 3600, // 28 days in seconds
  ONE_YEAR: 365 * 24 * 3600,

  // base price bump
  // +0.05% for each 1% of capacity used, ie +5% for 100%
  PRICE_BUMP_RATIO: 5_00, // 5%

  // bumped price smoothing
  // 2% per day
  PRICE_CHANGE_PER_DAY: 200, // 2%

  INITIAL_PRICE_DENOMINATOR: 100_00,
  TARGET_PRICE_DENOMINATOR: 100_00,

  MAX_TOTAL_WEIGHT: 20_00, // 20x
  WEIGHT_DENOMINATOR: 100,

  MAX_ACTIVE_TRANCHES: 8, // 7 whole quarters + 1 partial quarter

  NXM_PER_ALLOCATION_UNIT: parseEther('0.01'),

  MIN_COVER_PERIOD: 30 * 24 * 3600, // seconds
  MAX_COVER_PERIOD: 365 * 24 * 3600, // seconds

  CAPACITY_BUFFER_MINIMUM: parseEther('0.1'), // = 0.1 nxm = 10 allocation units
  CAPACITY_BUFFER_RATIO: 10, // 0.1%
  CAPACITY_BUFFER_DENOMINATOR: 100_00,

  SECONDS_PER_DAY: BigNumber.from(24 * 60 * 60),
};
