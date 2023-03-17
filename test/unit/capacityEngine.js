const sinon = require('sinon');
const { expect } = require('chai');
const capacityEngine = require('../../src/lib/capacityEngine');
const mockStore = require('../mocks/store');
const { BigNumber } = require('ethers');

const capacities = [
  {
    productId: 0,
    capacity: [
      {
        assetId: 0,
        amount: '4761714669056628480',
      },
      {
        assetId: 1,
        amount: '13305160151201388636532',
      },
      {
        assetId: 255,
        amount: '463200000000000000000',
      },
    ],
  },
  {
    productId: 1,
    capacity: [
      {
        assetId: 0,
        amount: '2380857334528314240',
      },
      {
        assetId: 1,
        amount: '6652580075600694318266',
      },
      {
        assetId: 255,
        amount: '231600000000000000000',
      },
    ],
  },
  {
    productId: 2,
    capacity: [
      {
        assetId: 0,
        amount: '4761714669056628480',
      },
      {
        assetId: 1,
        amount: '13305160151201388636532',
      },
      {
        assetId: 255,
        amount: '463200000000000000000',
      },
    ],
  },
];

describe('Capacity Engine tests', () => {
  const store = { getState: () => null };

  afterEach(function () {
    sinon.restore();
  });

  it('should return capacity for all products', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const now = BigNumber.from(Date.now()).div(1000);

    const response = capacityEngine(store, [], now);

    response.forEach((product, i) => {
      expect(product.productId).to.be.equal(capacities[i].productId);
      product.capacity.forEach(({ amount }, j) => {
        expect(amount.toString()).to.be.equal(capacities[i].capacity[j].amount);
      });
    });
  });

  it('should return capacity for one product', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const now = BigNumber.from(Date.now()).div(1000);

    const [product] = capacityEngine(store, ['0'], now);
    const [expectedCapacities] = capacities;

    expect(product.productId).to.be.equal(expectedCapacities.productId);
    product.capacity.forEach(({ amount }, i) => {
      expect(amount.toString()).not.to.be.equal(expectedCapacities.capacity[i]);
    });
  });

  it('should throw non existing product', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const now = BigNumber.from(Date.now()).div(1000);

    const [product] = capacityEngine(store, ['3'], now);

    expect(product).to.be.equal(undefined);
  });
});
