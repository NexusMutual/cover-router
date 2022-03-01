const ethers = require('ethers');
const assert = require('assert')
const { parseEther } = ethers.utils;
const { getPrices } = require('../../src/coverPrice');

describe('cover price', function () {
  describe('getPrices()', function () {
    const amount = parseEther('1000');

    const activeCover = parseEther('8000');
    const capacity = parseEther('10000');
    const initialPrice = '1000';
    const lastBasePrice = { value: '300', lastUpdateTime: 0 };
    const targetPrice = '150';
    const blockTimestamp = 24 * 3600;

    const { actualPrice, basePrice: newBasePrice } = getPrices(
      amount,
      activeCover,
      capacity,
      initialPrice,
      lastBasePrice,
      targetPrice,
      blockTimestamp,
    );

     const expectedNewBasePrice = '499';
    const expectedActualPrice = '448';

    assert.equal(newBasePrice.toString(), expectedNewBasePrice.toString());
    assert.equal(actualPrice.toString(), expectedActualPrice.toString());
  });
});