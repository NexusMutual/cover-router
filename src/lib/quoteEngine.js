const { BigNumber, ethers } = require('ethers');
const { calculateTrancheId, divCeil } = require('./helpers');
const { selectAssetRate, selectProductPools, selectProduct } = require('../store/selectors');

const { WeiPerEther, Zero, MaxUint256 } = ethers.constants;
const { formatEther } = ethers.utils;

const { bnMax, bnMin } = require('./helpers');

const {
  NXM_PER_ALLOCATION_UNIT,
  ONE_YEAR,
  PRICE_CHANGE_PER_DAY,
  SURGE_PRICE_RATIO,
  SURGE_THRESHOLD_DENOMINATOR,
  SURGE_THRESHOLD_RATIO,
  TARGET_PRICE_DENOMINATOR,
  MIN_UNIT_SIZE_DAI,
  SURGE_CHUNK_DIVISOR,
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

  return basePremium.add(surgePremium);
};

const calculatePoolPriceAndCapacity = (totalCapacity, basePrice, usedCapacity, useFixedPrice) => {
  const used = usedCapacity;
  const surgeStartPoint = totalCapacity.mul(SURGE_THRESHOLD_RATIO).div(SURGE_THRESHOLD_DENOMINATOR);
  // use 0.01% of total capacity or the remaining capacity, whichever is smaller
  const chunk = bnMin(totalCapacity.div(SURGE_CHUNK_DIVISOR), totalCapacity.sub(usedCapacity));

  if (totalCapacity.eq(0) || chunk.eq(0)) {
    return {
      chunk: Zero,
      chunkBasePrice: basePrice,
      poolBasePrice: basePrice,
      usedCapacity,
      totalCapacity,
    };
  }

  if (used.lt(surgeStartPoint) || useFixedPrice) {
    return {
      chunk: useFixedPrice ? totalCapacity.sub(usedCapacity) : surgeStartPoint.sub(used),
      chunkBasePrice: basePrice,
      poolBasePrice: basePrice,
      usedCapacity,
      totalCapacity,
    };
  }

  const amountOnSurgeSkip = used.sub(surgeStartPoint);

  // calculate base premium
  const basePremium = chunk.mul(basePrice).div(TARGET_PRICE_DENOMINATOR);

  // calculate surge premium
  const amountOnSurge = used.add(chunk).sub(surgeStartPoint);
  const totalSurgePremium = amountOnSurge.mul(amountOnSurge).mul(SURGE_PRICE_RATIO).div(totalCapacity).div(2);
  const skipSurgePremium = amountOnSurgeSkip.mul(amountOnSurgeSkip).mul(SURGE_PRICE_RATIO).div(totalCapacity).div(2);
  const surgePremium = totalSurgePremium.sub(skipSurgePremium);

  // calculate total premium
  const premium = basePremium.add(surgePremium);
  const chunkBasePrice = premium.mul(TARGET_PRICE_DENOMINATOR).div(chunk);

  return {
    chunk,
    chunkBasePrice,
    poolBasePrice: basePrice,
    usedCapacity,
    totalCapacity,
  };
};

/**
 * This function allocates chunks of capacity depending on the price for that amount
 *
 * To solve the allocation problem we map the chunks of capacities and their prices
 * and use that for the rest of the computations.
 *
 * With each iteration we recalculate the price and chunk for the pool used in the previous iteration
 *
 * if the pool is not in the surge we use the base price and capacity left until we reach the surge, once we reach
 * the surge we use percentage of the capacity for the chunk and calculate the price for that chunk.
 *
 * If there is no pool with capacity available the function returns
 * with an empty list (aborts allocation completely - no partial allocations supported).
 *
 * chunk size in the surge is dynamically computed as 0.01% (1 / SURGE_CHUNK_DIVISOR) of the total capacity.
 *
 * Complexity O(n)  where n is the number of chunks
 * @param coverAmount
 * @param pools
 * @param useFixedPrice
 * @returns {{lowestCostAllocation: *, lowestCost: *}}
 */
const calculateOptimalPoolAllocation = (coverAmount, pools, useFixedPrice = false) => {
  // Pool Id (number) -> Capacity Amount (BigNumber)
  const allocations = {};

  // map prices and their capacities
  const priceMapping = {};
  for (const pool of pools) {
    priceMapping[pool.poolId] = calculatePoolPriceAndCapacity(
      pool.totalCapacity,
      pool.basePrice,
      pool.initialCapacityUsed,
      useFixedPrice,
    );
  }

  let coverAmountLeft = coverAmount;
  while (coverAmountLeft.gt(0)) {
    // find the cheapest pool
    const lowestPricePool = Object.entries(priceMapping).reduce(
      (acc, [poolId, pool]) => {
        if (acc.chunkBasePrice.gt(pool.chunkBasePrice) && pool.chunk.gt(0)) {
          return {
            chunkBasePrice: pool.chunkBasePrice,
            poolBasePrice: pool.poolBasePrice,
            chunk: pool.chunk,
            usedCapacity: pool.usedCapacity,
            totalCapacity: pool.totalCapacity,
            poolId,
          };
        }
        return acc;
      },
      {
        chunk: Zero,
        chunkBasePrice: MaxUint256,
        poolId: Zero,
        poolBasePrice: Zero,
        usedCapacity: Zero,
        totalCapacity: Zero,
      },
    );

    if (lowestPricePool.chunk.eq(0)) {
      // not enough total capacity available
      return [];
    }

    const allocationAmount = bnMin(lowestPricePool.chunk, coverAmountLeft);

    allocations[lowestPricePool.poolId] = allocations[lowestPricePool.poolId]
      ? allocations[lowestPricePool.poolId].add(allocationAmount)
      : allocationAmount;

    coverAmountLeft = coverAmountLeft.sub(allocationAmount);

    priceMapping[lowestPricePool.poolId] = calculatePoolPriceAndCapacity(
      lowestPricePool.totalCapacity,
      lowestPricePool.poolBasePrice,
      lowestPricePool.usedCapacity.add(allocationAmount),
      useFixedPrice,
    );
  }

  return allocations;
};

const quoteEngine = (store, productId, amount, period, coverAsset) => {
  const product = selectProduct(store, productId);

  if (!product) {
    return null;
  }

  if (product.isDeprecated) {
    return {
      error: {
        isDeprecated: true,
      },
    };
  }

  const productPools = selectProductPools(store, productId);
  const assetRate = selectAssetRate(store, coverAsset);
  const assetRates = store.getState().assetRates;

  const now = BigNumber.from(Date.now()).div(1000);
  const gracePeriodExpiration = now.add(period).add(product.gracePeriod);

  const firstActiveTrancheId = calculateTrancheId(now);
  const firstUsableTrancheId = calculateTrancheId(gracePeriodExpiration);
  const firstUsableTrancheIndex = firstUsableTrancheId - firstActiveTrancheId;

  // TODO: use asset decimals instead of generic 18 decimals
  const coverAmountInNxm = amount.mul(WeiPerEther).div(assetRate);

  // rounding up to nearest allocation unit
  const amountToAllocate = divCeil(coverAmountInNxm, NXM_PER_ALLOCATION_UNIT).mul(NXM_PER_ALLOCATION_UNIT);
  console.log('Amount to allocate:', formatEther(amountToAllocate), 'nxm');

  const poolsData = productPools.map(pool => {
    const { poolId, targetPrice, bumpedPrice, bumpedPriceUpdateTime, allocations, trancheCapacities } = pool;

    const totalCapacity = trancheCapacities
      .slice(firstUsableTrancheIndex)
      .reduce((total, capacity) => total.add(capacity), Zero)
      .mul(NXM_PER_ALLOCATION_UNIT);

    const initialCapacityUsed = trancheCapacities
      .reduce((used, capacity, index) => {
        if (index < firstUsableTrancheIndex) {
          const carryOver = capacity.sub(allocations[index]);
          return carryOver.lt(0) ? used.add(carryOver.abs()) : used;
        }
        return used.add(allocations[index]);
      }, Zero)
      .mul(NXM_PER_ALLOCATION_UNIT);

    const basePrice = product.useFixedPrice
      ? targetPrice
      : calculateBasePrice(targetPrice, bumpedPrice, bumpedPriceUpdateTime, now);

    if (totalCapacity.lte(initialCapacityUsed)) {
      return {
        poolId,
        basePrice,
        initialCapacityUsed: Zero,
        totalCapacity: Zero,
      };
    }

    return {
      poolId,
      basePrice,
      initialCapacityUsed,
      totalCapacity,
    };
  });

  const allocations = calculateOptimalPoolAllocation(amountToAllocate, poolsData, product.useFixedPrice);

  const poolsWithPremium = Object.keys(allocations).map(poolId => {
    poolId = parseInt(poolId);

    const amountToAllocate = allocations[poolId];

    const pool = poolsData.find(data => poolId.toString() === data.poolId.toString());

    const premiumPerYear = product.useFixedPrice
      ? calculateFixedPricePremiumPerYear(amountToAllocate, pool.basePrice)
      : calculatePremiumPerYear(amountToAllocate, pool.basePrice, pool.initialCapacityUsed, pool.totalCapacity);

    const premiumInNxm = premiumPerYear.mul(period).div(ONE_YEAR);

    // TODO: use asset decimals instead of generic 18 decimals
    const premiumInAsset = premiumInNxm.mul(assetRate).div(WeiPerEther);

    const capacityInNxm = pool.totalCapacity.sub(pool.initialCapacityUsed);
    const capacity = Object.entries(assetRates).map(([assetId, rate]) => ({
      assetId,
      amount: capacityInNxm.mul(rate).div(WeiPerEther),
    }));

    console.log('Pool:', poolId);
    console.log('Initially used capacity:', formatEther(pool.initialCapacityUsed), 'nxm');
    console.log('Total pool capacity    :', formatEther(pool.totalCapacity), 'nxm');
    console.log('Pool capacity          :', formatEther(capacityInNxm), 'nxm');

    const coverAmountInAsset = amountToAllocate.mul(assetRate).div(WeiPerEther);

    return {
      poolId,
      premiumInNxm,
      premiumInAsset,
      coverAmountInNxm: amountToAllocate,
      coverAmountInAsset,
      capacities: { poolId: pool.poolId, capacity },
    };
  });

  return poolsWithPremium;
};

module.exports = {
  quoteEngine,
  calculateBasePrice,
  calculateFixedPricePremiumPerYear,
  calculatePremiumPerYear,
  calculateOptimalPoolAllocation,
};
