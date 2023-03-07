const { BigNumber } = require('ethers');

const {
  TRANCHE_DURATION,
  MAX_ACTIVE_TRANCHES,
  PRICE_CHANGE_PER_DAY,
  NXM_PER_ALLOCATION_UNIT,
  TARGET_PRICE_DENOMINATOR,
  SURGE_THRESHOLD_RATIO,
  SURGE_THRESHOLD_DENOMINATOR,
  SURGE_PRICE_RATIO,
} = require('./constants');
const { parseEther, parseUnits } = require('ethers/lib/utils');

// offset in seconds
function calculateCurrentTrancheId(offset = 0) {
  return BigNumber.from(Date.now()).div(1000).add(offset).div(TRANCHE_DURATION).toNumber();
}

function calculateCapacities(trancheCapacities, allocations, startingTrancheIndex) {
  let initialCapacityUsed = BigNumber.from(0);
  let totalCapacity = BigNumber.from(0);
  for (let i = startingTrancheIndex; i < MAX_ACTIVE_TRANCHES; i += 1) {
    totalCapacity = totalCapacity.add(trancheCapacities[i]);
    initialCapacityUsed = initialCapacityUsed.add(allocations[i]);
  }
  return { initialCapacityUsed, totalCapacity };
}

function basePriceSelector(pool, secondsSinceLastUpdate) {
  const priceDrop = Math.floor((PRICE_CHANGE_PER_DAY * secondsSinceLastUpdate) / 86_400);
  return Math.max(pool.targetPrice.toNumber(), pool.bumpedPrice.toNumber() - priceDrop);
}

function sortPools([, a], [, b]) {
  const secondsSinceLastUpdateA = Math.floor(Date.now() / 1000 - a.bumpedPriceUpdateTime.toNumber());
  const secondsSinceLastUpdateB = Math.floor(Date.now() / 1000 - b.bumpedPriceUpdateTime.toNumber());

  const basePriceA = basePriceSelector(a, secondsSinceLastUpdateA);
  const basePriceB = basePriceSelector(b, secondsSinceLastUpdateB);

  if (basePriceA < basePriceB) {
    return -1;
  }
  if (basePriceA > basePriceB) {
    return 1;
  }
  return 0;
}

// PREMIUM CALCULATIONS
function calculatePremium(
  coverAmount,
  period,
  targetPrice,
  bumpedPrice,
  secondsSinceLastUpdate,
  initialCapacityUsed,
  totalCapacity,
) {
  const basePrice = basePriceSelector({ targetPrice, bumpedPrice }, secondsSinceLastUpdate);

  console.log('coverAmount', coverAmount);
  // const basePremium = (coverAmount * NXM_PER_ALLOCATION_UNIT * basePrice) / TARGET_PRICE_DENOMINATOR;
  // BigNumber.from(coverAmount)
  const basePremium = parseUnits(coverAmount.toString(), 9)
    .mul(basePrice)
    .mul(NXM_PER_ALLOCATION_UNIT)
    .div(TARGET_PRICE_DENOMINATOR);
  const finalCapacityUsed = initialCapacityUsed.add(coverAmount);

  const surgeStartPoint = totalCapacity.mul(SURGE_THRESHOLD_RATIO).div(SURGE_THRESHOLD_DENOMINATOR);

  if (surgeStartPoint >= finalCapacityUsed) {
    return basePremium.mul(period).div(31_536_000);
  }

  const amountOnSurgeSkipped = initialCapacityUsed.sub(surgeStartPoint).gt(0)
    ? initialCapacityUsed.sub(surgeStartPoint)
    : 0;

  const amountOnSurge = finalCapacityUsed.sub(surgeStartPoint);
  let surgePremium = BigNumber.from(0);
  if (amountOnSurge.gt(0)) {
    surgePremium = calculateSurgePremium(amountOnSurge, totalCapacity, amountOnSurgeSkipped);
  }
  return basePremium.add(surgePremium).mul(period).div(31_536_000);
}

function calculateSurgePremium(amountOnSurge, totalCapacity, amountOnSurgeSkipped = 0) {
  let surgePremium = amountOnSurge.mul(SURGE_PRICE_RATIO).mul(amountOnSurge.div(totalCapacity)).mul(2);

  if (amountOnSurgeSkipped.gt(0)) {
    surgePremium = surgePremium
      .sub(amountOnSurgeSkipped.mul(SURGE_PRICE_RATIO).mul(amountOnSurgeSkipped.div(totalCapacity)))
      .div(2);
  }
  // amountOnSurge has two decimals
  // dividing by ALLOCATION_UNITS_PER_NXM (=100) to normalize the result
  return surgePremium.div(NXM_PER_ALLOCATION_UNIT);
}

module.exports = {
  calculateCurrentTrancheId,
  calculateCapacities,
  sortPools,
  calculatePremium,
};
