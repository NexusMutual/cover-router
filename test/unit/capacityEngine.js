const sinon = require('sinon');
const { expect } = require('chai');
const { createStore } = require('../../src/store');
const capacityEngine = require('../../src/lib/capacityEngine');
const mockStore = require('../mocks/store');
const { BigNumber } = require('ethers');

describe('Capacity Engine tests', () => {
  let store;

  before(() => {
    store = createStore();
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should return capacity for all products', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const now = BigNumber.from(Date.now()).div(1000);

    const response = capacityEngine(store, [], now);

    response.forEach((product, index) => {
      expect(product.productId).to.be.equal(index.toString());
      product.capacity.forEach(({ amount }) => {
        expect(amount.toString()).not.to.be.equal('0');
      });
    });
  });

  it('should return capacity for one product', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const now = BigNumber.from(Date.now()).div(1000);

    const [product] = capacityEngine(store, ['0'], now);

    expect(product.productId).to.be.equal('0');
    product.capacity.forEach(({ amount }) => {
      expect(amount.toString()).not.to.be.equal('0');
    });
  });

  it('should throw non existing product', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const now = BigNumber.from(Date.now()).div(1000);

    const [product] = capacityEngine(store, ['3'], now);

    expect(product).to.be.equal(undefined);
  });
});
