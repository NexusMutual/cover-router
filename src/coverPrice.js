const { BigNumber } = require('ethers');

const SURGE_THRESHOLD = BigNumber.from(8e17);
const BASE_SURGE_LOADING = 1e17;

const PRICE_RATIO_CHANGE_PER_DAY = 100;
const PRICE_DENOMINATOR = 10000;
const BASE_PRICE_BUMP_RATIO = 200; // 2%
const BASE_PRICE_BUMP_INTERVAL = 1000; // 10%
const BASE_PRICE_BUMP_DENOMINATOR = 10000;

function interpolatePrice (
  lastPrice,
  targetPrice,
  lastPriceUpdate,
  currentTimestamp,
) {

  const priceChange = (currentTimestamp - lastPriceUpdate) / (24 * 3600) * PRICE_RATIO_CHANGE_PER_DAY;

  if (targetPrice > lastPrice) {
    return targetPrice;
  }

  return lastPrice.sub(lastPrice.sub(targetPrice).muln(priceChange).divn(PRICE_DENOMINATOR));
}

function calculatePrice (
  amount,
  basePrice,
  activeCover,
  capacity) {

  amount = BigNumber.from(amount);
  basePrice = BigNumber.from(basePrice);
  activeCover = BigNumber.from(activeCover);
  capacity = BigNumber.from(capacity);

  const newActiveCoverAmount = amount.add(activeCover);
  const activeCoverRatio = activeCover.mul(1e18).div(capacity);
  const newActiveCoverRatio = newActiveCoverAmount.mul(1e18).div(capacity);

  if (newActiveCoverRatio.lt(SURGE_THRESHOLD)) {
    return basePrice;
  }

  const surgeLoadingRatio = newActiveCoverRatio.sub(SURGE_THRESHOLD);
  const surgeFraction =
    activeCoverRatio.gte(SURGE_THRESHOLD) ? BigNumber.from(1e18) : surgeLoadingRatio.mul(capacity).div(amount);
  const surgeLoading = surgeLoadingRatio.mul(BASE_SURGE_LOADING).div(1e16).div(2).mul(surgeFraction).div(1e18);

  return basePrice.mul(surgeLoading.add(1e18)).div(1e18).floor();
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

  console.log({
    lastBasePriceValue: lastBasePriceValue.toString(),
    basePrice: basePrice.toString(),
  });

  // calculate actualPrice using the current basePrice
  const actualPrice = calculatePrice(amount, basePrice, activeCover, capacity);

  // Bump base price by 2% (200 basis points) per 10% (1000 basis points) of capacity used
  const priceBump = amount.muln(BASE_PRICE_BUMP_DENOMINATOR).div(capacity).divn(BASE_PRICE_BUMP_INTERVAL).muln(BASE_PRICE_BUMP_RATIO);

  const bumpedBasePrice = basePrice.add(priceBump);

  return { basePrice: bumpedBasePrice, actualPrice };
}


module.exports = {
  getPrices,
}