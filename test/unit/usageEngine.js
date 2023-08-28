const sinon = require('sinon');
const { expect } = require('chai');

const usageEngine = require('../../src/lib/usageEngine');
const mockStore = require('../mocks/store');
const { usage } = require('./responses');

describe('Usage Engine tests', () => {
  const store = { getState: () => null };

  afterEach(function () {
    sinon.restore();
  });

  it('should return usage for all pools', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
    const response = usageEngine(store, []);

    response.forEach((pool, i) => {
      expect(pool.poolId).to.be.equal(usage[i].poolId);
      pool.products.forEach(({ productId, capacityUsed }, j) => {
        expect(productId).to.be.equal(usage[i].products[j].productId);
        capacityUsed.forEach(({ amount }, k) => {
          expect(amount.toString()).to.be.equal(usage[i].products[j].capacityUsed[k].amount);
        });
      });
    });
  });

  it('should return capacity for one product', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);

    const [pool] = usageEngine(store, ['1']);
    const [expectedUsage] = usage;

    expect(pool.poolId).to.be.equal(expectedUsage.poolId);
    pool.products.forEach(({ productId, capacityUsed }, i) => {
      expect(productId).to.be.equal(expectedUsage.products[i].productId);
      capacityUsed.forEach(({ amount }, j) => {
        expect(amount.toString()).to.be.equal(expectedUsage.products[j].capacityUsed[j].amount);
      });
    });
  });

  it('should throw non existing product', () => {
    sinon.stub(store, 'getState').callsFake(() => mockStore);

    const [pool] = usageEngine(store, ['10']);

    expect(pool.products.length).to.be.equal(0);
  });
});
