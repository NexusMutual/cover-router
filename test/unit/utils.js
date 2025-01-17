const { expect } = require('chai');
const { BigNumber, ethers } = require('ethers');

const { Zero } = ethers.constants;
const { NXM_PER_ALLOCATION_UNIT } = require('../../src/lib/constants');
const { calculateFirstUsableTrancheIndex, calculateAvailableCapacity } = require('../../src/lib/helpers');

const getCurrentTimestamp = () => BigNumber.from(Math.floor(Date.now() / 1000));

const verifyCapacityCalculation = (response, poolProduct, storeProduct, now, period) => {
  const firstUsableTrancheIndex = calculateFirstUsableTrancheIndex(now, storeProduct.gracePeriod, period);

  const availableCapacity = calculateAvailableCapacity(
    poolProduct.trancheCapacities,
    poolProduct.allocations,
    firstUsableTrancheIndex,
  );

  const nxmCapacity = response.availableCapacity.find(c => c.assetId === 255);

  return { availableCapacity, nxmCapacity };
};

const verifyUsedCapacity = (response, poolProduct) => {
  let totalUsedCapacity = Zero;
  poolProduct.allocations.forEach(allocation => {
    totalUsedCapacity = totalUsedCapacity.add(allocation);
  });
  expect(response.usedCapacity.toString()).to.equal(totalUsedCapacity.mul(NXM_PER_ALLOCATION_UNIT).toString());
  return totalUsedCapacity;
};

const calculateExpectedAvailableNXM = (poolIds, productId, poolProducts, firstUsableTrancheIndex) => {
  return poolIds.reduce((total, poolId) => {
    const poolProduct = poolProducts[`${productId}_${poolId}`];
    const availableCapacity = calculateAvailableCapacity(
      poolProduct.trancheCapacities,
      poolProduct.allocations,
      firstUsableTrancheIndex,
    );
    return total.add(availableCapacity.mul(NXM_PER_ALLOCATION_UNIT));
  }, Zero);
};

const calculateExpectedUsedCapacity = poolProduct => {
  return poolProduct.allocations.reduce((sum, alloc) => sum.add(alloc), Zero).mul(NXM_PER_ALLOCATION_UNIT);
};

const calculateExpectedUsedCapacityAcrossPools = (poolIds, productId, poolProducts) => {
  return poolIds.reduce((total, poolId) => {
    const poolProduct = poolProducts[`${productId}_${poolId}`];
    return total.add(calculateExpectedUsedCapacity(poolProduct));
  }, Zero);
};

const verifyCapacityResponse = (
  response,
  expectedKeys = ['productId', 'availableCapacity', 'usedCapacity', 'minAnnualPrice', 'maxAnnualPrice'],
) => {
  expect(response).to.have.all.keys(expectedKeys);
  expect(response.availableCapacity).to.be.an('array');
  expect(response.usedCapacity).to.be.instanceOf(BigNumber);
  expect(response.minAnnualPrice).to.be.instanceOf(BigNumber);
  expect(response.maxAnnualPrice).to.be.instanceOf(BigNumber);
};

module.exports = {
  getCurrentTimestamp,
  verifyCapacityCalculation,
  verifyUsedCapacity,
  calculateExpectedAvailableNXM,
  calculateExpectedUsedCapacity,
  calculateExpectedUsedCapacityAcrossPools,
  verifyCapacityResponse,
};
