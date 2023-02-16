const constants = require('./constants');
const {
  PRICE_CHANGE_PER_DAY,
  NXM_PER_ALLOCATION_UNIT,
  SURGE_THRESHOLD_RATIO,
  SURGE_PRICE_RATIO,
  TARGET_PRICE_DENOMINATOR,
} = constants;
/*
 *
 *   basePrice = MAX(bumpedPrice - priceDrop, targetPrice)
 *   Example*
 *
 *   speed = 1% per day
 *   timeSinceLastCoverBuy = 30 days
 *   priceDrop = 30 * 1% = 0.3%
 *   bumpedPrice = 5.5%
 *   targetPrice = 3%
 *   basePrice = MAX(5.5% - 0.3%, 3%) = 5.2%
 **/
// function calculateBasePrice() {}
/*
 * basePremium = cover amount * basePrice
 * */
// function calculateBasePremium() {}
/*
 * premium = basePremium + surgePremium
 * */
function calculateSurgePremium(amountOnSurge, totalCapacity, amountOnSurgeSkipped = 0) {
  let surgePremium = (amountOnSurge * SURGE_PRICE_RATIO * (amountOnSurge / totalCapacity)) / 2;

  if (amountOnSurgeSkipped > 0) {
    surgePremium =
      surgePremium - (amountOnSurgeSkipped * SURGE_PRICE_RATIO * (amountOnSurgeSkipped / totalCapacity)) / 2;
  }
  // amountOnSurge has two decimals
  // dividing by ALLOCATION_UNITS_PER_NXM (=100) to normalize the result
  return surgePremium / NXM_PER_ALLOCATION_UNIT;
}

function calculatePremium(
  coverAmount,
  period,
  targetPrice,
  bumpedPrice,
  daysSinceLastUpdate,
  initialCapacityUsed,
  totalCapacity,
) {
  const priceDrop = PRICE_CHANGE_PER_DAY * daysSinceLastUpdate;
  const basePrice = Math.max(targetPrice, bumpedPrice - priceDrop) / TARGET_PRICE_DENOMINATOR;

  //    TODO: add logic for new bumpedPrice

  // const basePremium = (coverAmount * NXM_PER_ALLOCATION_UNIT * basePrice) / TARGET_PRICE_DENOMINATOR;
  const basePremium = coverAmount * basePrice;
  const finalCapacityUsed = initialCapacityUsed + coverAmount;

  const surgeStartPoint = totalCapacity * SURGE_THRESHOLD_RATIO;

  if (surgeStartPoint >= finalCapacityUsed) {
    return basePremium;
  }

  const amountOnSurgeSkipped = initialCapacityUsed - surgeStartPoint > 0 ? initialCapacityUsed - surgeStartPoint : 0;

  const amountOnSurge = finalCapacityUsed - surgeStartPoint;
  let surgePremium = 0;
  if (amountOnSurge > 0) {
    surgePremium = calculateSurgePremium(amountOnSurge, totalCapacity, amountOnSurgeSkipped);
  }
  return ((basePremium + surgePremium) / 365) * period;
}

module.exports = {
  calculatePremium,
};
