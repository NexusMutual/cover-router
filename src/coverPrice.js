const { BigNumber,  utils: { parseUnits } } = require('ethers');


const SURGE_THRESHOLD = parseUnits('0.8');
const BASE_SURGE_LOADING = parseUnits('0.1'); // 10%
const BASE_SURGE_CAPACITY_USED = parseUnits('0.01'); // 1%

const PRICE_RATIO_CHANGE_PER_DAY = parseUnits('0.005'); // 0.5%
const BASE_PRICE_BUMP_RATIO = parseUnits('0.02'); // 2%
const BASE_PRICE_BUMP_INTERVAL = 1000; // 10%
const BASE_PRICE_BUMP_DENOMINATOR = 10000;

const PRICE_DENOMINATOR = parseUnits('1');

function interpolatePrice (
  lastPriceRatio,
  targetPriceRatio,
  lastPriceUpdate,
  currentTimestamp,
) {

  const priceChange = BigNumber.from(currentTimestamp - lastPriceUpdate).div(24 * 3600).mul(PRICE_RATIO_CHANGE_PER_DAY);

  if (lastPriceRatio.lt(targetPriceRatio.add(priceChange))) {
    return targetPriceRatio;
  }

  return lastPriceRatio.sub(priceChange);
}

function calculatePrice (
  amount,
  basePriceRatio,
  activeCover,
  capacity) {

  amount = BigNumber.from(amount);
  basePriceRatio = BigNumber.from(basePriceRatio);
  activeCover = BigNumber.from(activeCover);
  capacity = BigNumber.from(capacity);

  const newActiveCoverAmount = amount.add(activeCover);
  const activeCoverRatio = activeCover.mul(1e18.toString()).div(capacity);
  const newActiveCoverRatio = newActiveCoverAmount.mul(1e18.toString()).div(capacity);

  if (newActiveCoverRatio.lt(SURGE_THRESHOLD)) {
    return basePriceRatio;
  }

  const capacityUsedSteepRatio = activeCoverRatio.gte(SURGE_THRESHOLD) ? newActiveCoverRatio.sub(activeCoverRatio) : newActiveCoverRatio.sub(SURGE_THRESHOLD);
  const capacityUsedRatio = newActiveCoverRatio.sub(activeCoverRatio);

  const startSurgeLoadingRatio =
    activeCoverRatio.lt(SURGE_THRESHOLD) ? BigNumber.from(0)
      : activeCoverRatio.sub(SURGE_THRESHOLD).mul(BASE_SURGE_LOADING).div(BASE_SURGE_CAPACITY_USED);
  const endSurgeLoadingRatio = newActiveCoverRatio.sub(SURGE_THRESHOLD).mul(BASE_SURGE_LOADING).div(BASE_SURGE_CAPACITY_USED);

  const surgeLoadingRatio = capacityUsedSteepRatio.mul(endSurgeLoadingRatio.add(startSurgeLoadingRatio).div(2)).div(capacityUsedRatio);

  const actualPriceRatio = basePriceRatio.mul(surgeLoadingRatio.add(PRICE_DENOMINATOR)).div(PRICE_DENOMINATOR);
  return actualPriceRatio;

}

function getPrices (
  amount,
  activeCover,
  capacity,
  initialPrice,
  lastBasePrice,
  targetPrice,
  blockTimestamp,
) {

  amount = BigNumber.from(amount);
  activeCover = BigNumber.from(activeCover);
  capacity = BigNumber.from(capacity);
  initialPrice = BigNumber.from(initialPrice);
  targetPrice = BigNumber.from(targetPrice);
  const lastBasePriceValue = BigNumber.from(lastBasePrice.value);
  const lastUpdateTime = BigNumber.from(lastBasePrice.lastUpdateTime);

  const basePrice = interpolatePrice(
    lastBasePriceValue.gt(0) ? lastBasePriceValue : initialPrice,
    targetPrice,
    lastUpdateTime,
    blockTimestamp,
  );
  // calculate actualPrice using the current basePrice
  const actualPrice = calculatePrice(amount, basePrice, activeCover, capacity);

  // Bump base price by 2% (200 basis points) per 10% (1000 basis points) of capacity used
  const priceBump = BASE_PRICE_BUMP_RATIO.mul(amount).mul(BASE_PRICE_BUMP_DENOMINATOR).div(capacity).div(BASE_PRICE_BUMP_INTERVAL);

  const bumpedBasePrice = basePrice.add(priceBump);

  return { basePrice: bumpedBasePrice, actualPrice };
}


module.exports = {
  getPrices,
}