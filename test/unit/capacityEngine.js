const sinon = require('sinon');
const { expect } = require('chai');
const { BigNumber } = require('ethers');

const capacityEngine = require('../../src/lib/capacityEngine');
const mockStore = require('../mocks/store');
const { capacities } = require('./responses');
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
