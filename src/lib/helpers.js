const { BigNumber, ethers } = require('ethers');
const axios = require('axios');

const config = require('../config');
const {
  TRANCHE_DURATION_DAYS,
  MAX_ACTIVE_TRANCHES,
  PRICE_CHANGE_PER_DAY,
  NXM_PER_ALLOCATION_UNIT,
  TARGET_PRICE_DENOMINATOR,
  SURGE_THRESHOLD_RATIO,
  SURGE_PRICE_RATIO,
} = require('./constants');

async function getContractFactory(provider) {
  const url = config.get('contractsUrl');
  const {
    data: {
      mainnet: { abis },
    },
  } = await axios.get(url);

  const data = abis.reduce((acc, contract) => {
    const { code, address, contractName, contractAbi } = contract;
    acc[code] = {
      address,
      contractName,
      abi: JSON.parse(contractAbi),
    };
    return acc;
  }, {});

  return async code => {
    const { abi, address } = data[code];
    return new ethers.Contract(address, abi, provider);
  };
}

// offest in days
function calculateTranche(offset = 0) {
  return Math.floor((Date.now() / 86_400_000 + offset) / TRANCHE_DURATION_DAYS);
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
  const priceDrop = Math.floor((PRICE_CHANGE_PER_DAY * secondsSinceLastUpdate) / 86_400);
  const basePrice = Math.max(targetPrice, bumpedPrice - priceDrop);

  // const basePremium = (coverAmount * NXM_PER_ALLOCATION_UNIT * basePrice) / TARGET_PRICE_DENOMINATOR;
  const basePremium = (coverAmount * basePrice * NXM_PER_ALLOCATION_UNIT) / TARGET_PRICE_DENOMINATOR;
  const finalCapacityUsed = initialCapacityUsed.toNumber() + coverAmount;

  const surgeStartPoint = totalCapacity.toNumber() * SURGE_THRESHOLD_RATIO;

  if (surgeStartPoint >= finalCapacityUsed) {
    return Math.floor((basePremium * period) / (365 * 86_400));
  }

  const amountOnSurgeSkipped = initialCapacityUsed - surgeStartPoint > 0 ? initialCapacityUsed - surgeStartPoint : 0;

  const amountOnSurge = finalCapacityUsed - surgeStartPoint;
  let surgePremium = 0;
  if (amountOnSurge > 0) {
    surgePremium = calculateSurgePremium(amountOnSurge, totalCapacity, amountOnSurgeSkipped);
  }
  return Math.floor(((basePremium + surgePremium) * period) / (365 * 86_400));
}

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

getContractFactory();
module.exports = {
  calculateTranche,
  calculateCapacities,
  sortPools,
  calculatePremium,
};
