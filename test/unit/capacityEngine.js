const sinon = require('sinon');
const { expect } = require('chai');
const { BigNumber } = require('ethers');

const capacityEngine = require('../../src/lib/capacityEngine');
const mockStore = require('../mocks/store');
const { capacities } = require('./responses');
const { selectAsset } = require('../../src/store/selectors');

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
      product.availableCapacity.forEach(({ assetId, amount, asset }, j) => {
        expect(amount.toString()).to.be.equal(capacities[i].availableCapacity[j].amount);
        expect(asset).to.deep.equal(selectAsset(store, assetId));
      });
    });
  });

  it('should return capacity for one product', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const now = BigNumber.from(Date.now()).div(1000);

    const [product] = capacityEngine(store, ['0'], now);
    const [expectedCapacities] = capacities;

    expect(product.productId).to.be.equal(expectedCapacities.productId);
    product.availableCapacity.forEach(({ assetId, amount, asset }, i) => {
      expect(amount.toString()).not.to.be.equal(expectedCapacities.availableCapacity[i]);
      expect(asset).to.deep.equal(selectAsset(store, assetId));
    });
  });

  it('should throw non existing product', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const now = BigNumber.from(Date.now()).div(1000);

    const [product] = capacityEngine(store, ['4'], now);

    expect(product).to.be.equal(undefined);
  });
});
