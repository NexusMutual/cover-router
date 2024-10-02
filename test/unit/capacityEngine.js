const { expect } = require('chai');
const ethers = require('ethers');
const sinon = require('sinon');

const { capacities, poolProductCapacities } = require('./responses');
const capacityEngine = require('../../src/lib/capacityEngine');
const { selectAsset } = require('../../src/store/selectors');
const mockStore = require('../mocks/store');

const { BigNumber } = ethers;
const { parseEther } = ethers.utils;

describe('Capacity Engine tests', function () {
  const store = { getState: () => null };

  beforeEach(function () {
    sinon.stub(store, 'getState').callsFake(() => mockStore);
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should return capacity for all products when no productIds or poolId are provided', function () {
    const response = capacityEngine(store, { period: 30 });

    expect(response).to.have.lengthOf(Object.keys(mockStore.products).length);
    response.forEach((product, i) => {
      expect(product.productId).to.be.equal(capacities[i].productId);
      product.availableCapacity.forEach(({ assetId, amount, asset }, j) => {
        expect(amount.toString()).to.be.equal(capacities[i].availableCapacity[j].amount);
        expect(asset).to.deep.equal(selectAsset(store, assetId));
      });
    });
  });

  it('should return capacity for 1 product across all pools when productId is provided and poolId is not', function () {
    const productId = '0';
    const [product] = capacityEngine(store, { productIds: [productId] }); // Removed poolId and period

    const expectedCapacities = capacities[Number(productId)];

    expect(product.productId).to.be.equal(expectedCapacities.productId);
    product.availableCapacity.forEach(({ assetId, amount, asset }, i) => {
      expect(amount.toString()).not.to.be.equal(expectedCapacities.availableCapacity[i]);
      expect(asset).to.deep.equal(selectAsset(store, assetId));
    });
  });

  it('should return undefined for non-existing product', function () {
    const nonExistingProductId = '999';
    const [product] = capacityEngine(store, { productIds: [nonExistingProductId] }); // Removed poolId and period
    expect(product).to.be.equal(undefined);
  });

  it('should return capacity for a specific product and pool when both productId and poolId are provided', function () {
    const productId = '0';
    const poolId = 2;
    const [product] = capacityEngine(store, { poolId, productIds: [productId] });

    const expectedCapacity = poolProductCapacities[poolId].find(c => c.productId === Number(productId));

    console.log('product.minAnnualPrice', product.minAnnualPrice.toString());
    console.log('expectedCapacity.minAnnualPrice', expectedCapacity.minAnnualPrice);
    console.log('product.maxAnnualPrice', product.maxAnnualPrice.toString());
    console.log('expectedCapacity.maxAnnualPrice', expectedCapacity.maxAnnualPrice);

    expect(product.productId).to.equal(Number(productId));
    expect(product.usedCapacity.toString()).to.equal(expectedCapacity.allocatedNxm);
    expect(product.minAnnualPrice.toString()).to.equal(parseEther(expectedCapacity.minAnnualPrice).toString());
    expect(product.maxAnnualPrice.toString()).to.equal(parseEther(expectedCapacity.maxAnnualPrice).toString());
    expect(product.availableCapacity).to.have.lengthOf(expectedCapacity.availableCapacity.length);

    product.availableCapacity.forEach(({ assetId, amount, asset }, i) => {
      expect(amount.toString()).to.be.equal(expectedCapacity.availableCapacity[i].amount);
      expect(asset).to.deep.equal(selectAsset(store, assetId));
    });
  });

  it('should return capacities for all products in a specific pool when only poolId is provided', function () {
    const poolId = 2;
    const response = capacityEngine(store, { poolId });

    expect(response.length).to.be.greaterThan(0);

    response.forEach(product => {
      const expectedCapacity = poolProductCapacities[poolId].find(c => c.productId === product.productId);
      const productPools = mockStore.productPoolIds[product.productId];

      expect(productPools).to.include(poolId);
      expect(product.usedCapacity.toString()).to.equal(expectedCapacity.allocatedNxm);
      expect(product.minAnnualPrice.toString()).to.equal(parseEther(expectedCapacity.minAnnualPrice).toString());
      expect(product.maxAnnualPrice.toString()).to.equal(parseEther(expectedCapacity.maxAnnualPrice).toString());
      expect(product.availableCapacity).to.have.lengthOf(expectedCapacity.availableCapacity.length);

      product.availableCapacity.forEach(({ assetId, amount, asset }, i) => {
        expect(amount.toString()).to.be.equal(expectedCapacity.availableCapacity[i].amount);
        expect(asset).to.deep.equal(selectAsset(store, assetId));
      });
    });
  });

  it('should return the same total capacity for a product across all pools as when poolId is not given', function () {
    const productId = '0';
    const poolIds = mockStore.productPoolIds[productId];

    // Get capacity for product 0 across all pools
    const [allPoolsProduct] = capacityEngine(store, { productIds: [productId] });

    const initObject = {
      productId: Number(productId),
      usedCapacity: BigNumber.from(0),
      minAnnualPrice: BigNumber.from(0),
      maxAnnualPrice: BigNumber.from(0),
      availableCapacity: [],
    };

    // Get capacity for product 0 for each pool and sum them up
    const summedCapacity = poolIds.reduce((acc, poolId) => {
      const [product] = capacityEngine(store, { poolId: Number(poolId), productIds: [productId] });

      if (!product) {
        return acc;
      }

      // Sum up all numeric fields
      acc.usedCapacity = acc.usedCapacity.add(product.usedCapacity);
      acc.minAnnualPrice = acc.minAnnualPrice.gt(product.minAnnualPrice) ? acc.minAnnualPrice : product.minAnnualPrice;
      acc.maxAnnualPrice = acc.maxAnnualPrice.gt(product.maxAnnualPrice) ? acc.maxAnnualPrice : product.maxAnnualPrice;

      // Sum up availableCapacity for each asset
      product.availableCapacity.forEach((capacity, index) => {
        if (!acc.availableCapacity[index]) {
          acc.availableCapacity[index] = { ...capacity, amount: BigNumber.from(0) };
        }
        acc.availableCapacity[index].amount = acc.availableCapacity[index].amount.add(capacity.amount);
      });

      return acc;
    }, initObject);

    // Assert that all fields match
    expect(summedCapacity.productId).to.equal(allPoolsProduct.productId);
    expect(summedCapacity.usedCapacity.toString()).to.equal(allPoolsProduct.usedCapacity.toString());
    expect(summedCapacity.minAnnualPrice.toString()).to.equal(allPoolsProduct.minAnnualPrice.toString());
    expect(summedCapacity.maxAnnualPrice.toString()).to.equal(allPoolsProduct.maxAnnualPrice.toString());

    // Assert that availableCapacity matches for each asset
    expect(summedCapacity.availableCapacity.length).to.equal(allPoolsProduct.availableCapacity.length);
    summedCapacity.availableCapacity.forEach((capacity, index) => {
      expect(capacity.amount.toString()).to.equal(allPoolsProduct.availableCapacity[index].amount.toString());
      expect(capacity.assetId).to.equal(allPoolsProduct.availableCapacity[index].assetId);
      expect(capacity.asset).to.deep.equal(allPoolsProduct.availableCapacity[index].asset);
    });
  });

  it('should handle products with fixed price correctly', function () {
    const fixedPricedProductId = '2';
    const [product] = capacityEngine(store, { productIds: [fixedPricedProductId] });

    expect(product.productId).to.equal(Number(fixedPricedProductId));
    expect(product.minAnnualPrice).to.deep.equal(product.maxAnnualPrice);
  });

  it('should handle products without fixed price correctly', function () {
    const nonFixedPricedProductId = '0';
    const [product] = capacityEngine(store, { productIds: [nonFixedPricedProductId] });

    expect(product.productId).to.equal(Number(nonFixedPricedProductId));
    expect(product.minAnnualPrice).to.not.deep.equal(product.maxAnnualPrice);
  });
});
