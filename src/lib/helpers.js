const { TRANCHE_DURATION_DAYS, MAX_ACTIVE_TRANCHES, PRICE_CHANGE_PER_DAY } = require('./constants');

// offest in days
function calculateTranche(offset = 0) {
  return Math.floor(Date.now() / 86_400_000 + offset) / TRANCHE_DURATION_DAYS;
}

function calculateCapacities(trancheCapacities, allocations, startingTrancheIndex) {
  let initialCapacityUsed = 0;
  let totalCapacity = 0;
  for (let i = startingTrancheIndex; i < MAX_ACTIVE_TRANCHES; i += 1) {
    totalCapacity += trancheCapacities[i];
    initialCapacityUsed += allocations[i];
  }
  return { initialCapacityUsed, totalCapacity };
}

function sortPools([, a], [, b]) {
  const daysSinceLastUpdateA = Math.floor((Date.now() / 1000 - a.bumpedPriceUpdateTime.toNumber()) / 86_400);
  const daysSinceLastUpdateB = Math.floor((Date.now() / 1000 - b.bumpedPriceUpdateTime.toNumber()) / 86_400);

  const basePriceA = Math.max(
    a.targetPrice.toNumber(),
    a.bumpedPrice.toNumber() - daysSinceLastUpdateA * PRICE_CHANGE_PER_DAY,
  );
  const basePriceB = Math.max(
    b.targetPrice.toNumber(),
    b.bumpedPrice.toNumber() - daysSinceLastUpdateB * PRICE_CHANGE_PER_DAY,
  );
  if (basePriceA < basePriceB) {
    return -1;
  }
  if (basePriceA > basePriceB) {
    return 1;
  }
  return 0;
}

module.exports = {
  calculateTranche,
  calculateCapacities,
  sortPools,
};
