const ethers = require('ethers');
const assert = require('assert');
const { BigNumber } = ethers;
const { parseEther, parseUnits } = ethers.utils;
const { getPrices } = require('../../src/coverPrice');

function bnEqual (actual, expected, message) {

  const actualBN = BigNumber.from(actual);
  const expectedBN = BigNumber.from(expected);
  const error = message || `expected ${actualBN.toString()} to equal ${expectedBN.toString()}`;

  if (actualBN.eq(expectedBN)) {
    return;
  }

  throw new assert.AssertionError({
    message: error,
    actual: actualBN.toString(),
    expected: expectedBN.toString(),
    operator: 'bnEqual',
  });
}


describe('getPrices', function () {

  it('should calculate price correctly for active cover starting at 0 without surge', async function () {
    const { stakingPool } = this;

    const amount = parseUnits('2400');
    const activeCover = parseUnits('0');
    const capacity = parseUnits('50000');
    const initialPrice = parseUnits('0.2');
    const lastBasePrice = { value: parseUnits('0.02'), lastUpdateTime: 0 };
    const targetPrice = parseUnits('0.02');
    const blockTimestamp = 24 * 3600 * 183;

    const { actualPrice, basePrice: newBasePrice } = getPrices(
      amount,
      activeCover,
      capacity,
      initialPrice,
      lastBasePrice,
      targetPrice,
      blockTimestamp,
    );

    const expectedNewBasePrice = parseUnits('0.0296');
    const expectedActualPrice = parseUnits('0.02');

    bnEqual(newBasePrice, expectedNewBasePrice);
    bnEqual(actualPrice, expectedActualPrice);
  });

  it('should calculate price correctly for active cover without surge starting off at base price = target price', async function () {
    const { stakingPool } = this;

    const amount = parseUnits('12000');
    const activeCover = parseUnits('2400');
    const capacity = parseUnits('50000');
    const initialPrice = parseUnits('0.2');
    const lastBasePrice = { value: parseUnits('0.0296'), lastUpdateTime: 0 };
    const targetPrice = parseUnits('0.02');
    const blockTimestamp = 24 * 3600 * 3;

    const { actualPrice, basePrice: newBasePrice } = getPrices(
      amount,
      activeCover,
      capacity,
      initialPrice,
      lastBasePrice,
      targetPrice,
      blockTimestamp,
    );

    const expectedNewBasePrice = parseUnits('0.068');
    const expectedActualPrice = parseUnits('0.02');

    bnEqual(newBasePrice, expectedNewBasePrice);
    bnEqual(actualPrice, expectedActualPrice);
  });

  it('should calculate price correctly for active cover without surge starting off at base price > target price', async function () {
    const { stakingPool } = this;

    const amount = parseUnits('12000');
    const activeCover = parseUnits('14400');
    const capacity = parseUnits('50000');
    const initialPrice = parseUnits('0.2');
    const lastBasePrice = { value: parseUnits('0.068'), lastUpdateTime: 0 };
    const targetPrice = parseUnits('0.02');
    const blockTimestamp = 24 * 3600 * 5;

    const { actualPrice, basePrice: newBasePrice } = getPrices(
      amount,
      activeCover,
      capacity,
      initialPrice,
      lastBasePrice,
      targetPrice,
      blockTimestamp,
    );

    const expectedNewBasePrice = parseUnits('0.091');
    const expectedActualPrice = parseUnits('0.043');

    bnEqual(newBasePrice, expectedNewBasePrice);
    bnEqual(actualPrice, expectedActualPrice);
  });

  it('should calculate price correctly for active cover without surge which increases base price', async function () {
    const { stakingPool } = this;

    const amount = parseUnits('12000');
    const activeCover = parseUnits('26400');
    const capacity = parseUnits('50000');
    const initialPrice = parseUnits('0.2');
    const lastBasePrice = { value: parseUnits('0.091'), lastUpdateTime: 0 };
    const targetPrice = parseUnits('0.02');
    const blockTimestamp = 24 * 3600 * 5;

    const { actualPrice, basePrice: newBasePrice } = getPrices(
      amount,
      activeCover,
      capacity,
      initialPrice,
      lastBasePrice,
      targetPrice,
      blockTimestamp,
    );

    const expectedNewBasePrice = parseUnits('0.114');
    const expectedActualPrice = parseUnits('0.066');

    bnEqual(newBasePrice, expectedNewBasePrice);
    bnEqual(actualPrice, expectedActualPrice);
  });

  it('should calculate price correctly for active cover with both flat and surge pricing', async function () {
    const { stakingPool } = this;

    const amount = parseUnits('8000');
    const activeCover = parseUnits('38400');
    const capacity = parseUnits('50000');
    const initialPrice = parseUnits('0.2');
    const lastBasePrice = { value: parseUnits('0.114'), lastUpdateTime: 0 };
    const targetPrice = parseUnits('0.02');
    const blockTimestamp = 24 * 3600 * 15;

    const { actualPrice, basePrice: newBasePrice } = getPrices(
      amount,
      activeCover,
      capacity,
      initialPrice,
      lastBasePrice,
      targetPrice,
      blockTimestamp,
    );

    const expectedNewBasePrice = parseUnits('0.071');
    const expectedActualPrice = parseUnits('0.058968');

    bnEqual(newBasePrice, expectedNewBasePrice);
    bnEqual(actualPrice, expectedActualPrice);
  });

  it('should calculate price correctly for active cover with surge pricing only', async function () {
    const { stakingPool } = this;

    const amount = parseEther('2400');
    const activeCover = parseEther('46400');
    const capacity = parseEther('50000');
    const initialPrice = parseUnits('0.2');
    const lastBasePrice = { value: parseUnits('0.071'), lastUpdateTime: 0 };
    const targetPrice = parseUnits('0.02');
    const blockTimestamp = 24 * 3600 * 10;

    const { actualPrice, basePrice: newBasePrice } = getPrices(
      amount,
      activeCover,
      capacity,
      initialPrice,
      lastBasePrice,
      targetPrice,
      blockTimestamp,
    );

    const expectedNewBasePrice = parseUnits('0.0306');
    const expectedActualPrice = parseUnits('0.05292');

    bnEqual(newBasePrice, expectedNewBasePrice);
    bnEqual(actualPrice, expectedActualPrice);
  });

});
