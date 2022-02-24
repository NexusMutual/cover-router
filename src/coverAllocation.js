
function calculateCapacityAllocation(pools, coverAmount) {

  const sortedPoolsWithPrices = [];
  for (const pool of pools) {
    const { coveredAmount, price } = calculatePoolPrice(pool, coverAmount);

    sortedPoolsWithPrices.push({
      coveredAmount,
      price,
      pool
    })
  }

  sortedPoolsWithPrices.sort(((a, b) => a.price.lt(b.price) ));

  const poolAllocations = [];
  let amountLeftToCover = coverAmount;
  for (const poolWithPrice of sortedPoolsWithPrices) {
    const { coveredAmount, price } = poolWithPrice;

    poolAllocations.push(poolWithPrice);
    if (coveredAmount.gte(amountLeftToCover)) {
      break;
    }
    amountLeftToCover = amountLeftToCover.sub(coveredAmount);
  }

  return poolAllocations;
}

function calculatePoolPrice(pool, coverAmount) {
  // TODO: implement
}

module.exports = {
  calculateCapacityAllocation
}


