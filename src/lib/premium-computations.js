const { ethers } = require('ethers');
const { bnMax } = require('./helpers');

const { Zero } = ethers.constants;
const { formatEther, formatUnits } = ethers.utils;

const {
  PRICE_CHANGE_PER_DAY,
  SURGE_PRICE_RATIO,
  SURGE_THRESHOLD_DENOMINATOR,
  SURGE_THRESHOLD_RATIO,
  TARGET_PRICE_DENOMINATOR,
} = require('./constants');
const calculateBasePrice = (targetPrice, bumpedPrice, bumpedPriceUpdateTime, now) => {
  const elapsed = now.sub(bumpedPriceUpdateTime);
  const priceDrop = elapsed.mul(PRICE_CHANGE_PER_DAY).div(3600 * 24);
  return bnMax(targetPrice, bumpedPrice.sub(priceDrop));
};

const calculateFixedPricePremiumPerYear = (coverAmount, price) => {
  return coverAmount.mul(price).div(TARGET_PRICE_DENOMINATOR);
};

const calculatePremiumPerYear = (coverAmount, basePrice, initialCapacityUsed, totalCapacity) => {
  const basePremium = coverAmount.mul(basePrice).div(TARGET_PRICE_DENOMINATOR);
  const finalCapacityUsed = initialCapacityUsed.add(coverAmount);
  const surgeStartPoint = totalCapacity.mul(SURGE_THRESHOLD_RATIO).div(SURGE_THRESHOLD_DENOMINATOR);

  if (finalCapacityUsed.lte(surgeStartPoint)) {
    return basePremium;
  }

  const amountOnSurgeSkip = initialCapacityUsed.sub(surgeStartPoint).gt(0)
    ? initialCapacityUsed.sub(surgeStartPoint)
    : Zero;

  const amountOnSurge = finalCapacityUsed.sub(surgeStartPoint);
  const totalSurgePremium = amountOnSurge.mul(amountOnSurge).mul(SURGE_PRICE_RATIO).div(totalCapacity).div(2);
  const skipSurgePremium = amountOnSurgeSkip.mul(amountOnSurgeSkip).mul(SURGE_PRICE_RATIO).div(totalCapacity).div(2);
  const surgePremium = totalSurgePremium.sub(skipSurgePremium);

  console.log('Cover amount   :', formatEther(coverAmount), 'nxm');
  console.log('Amount on surge:', formatEther(amountOnSurge), 'nxm');

  console.log('Base price     :', formatUnits(basePrice, 4), 'nxm');
  console.log('Base premium   :', formatEther(basePremium), 'nxm');
  console.log('Surge skipped  :', formatEther(skipSurgePremium), 'nxm');
  console.log('Surge premium  :', formatEther(surgePremium), 'nxm');

  return basePremium.add(surgePremium);
};

const calculateOptimalPoolAllocationBruteForce = (coverAmount, pools) => {
  
}
const calculateOptimalPoolAllocation = (coverAmount, pools) => {

}

module.exports = {
  calculateBasePrice,
  calculateFixedPricePremiumPerYear,
  calculatePremiumPerYear,
  calculateOptimalPoolAllocation
}