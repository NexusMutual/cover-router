const { expect } = require('chai');
const ethers = require('ethers');
const sinon = require('sinon');

const { assets, capacities, poolProductCapacities } = require('./responses');
const { capacityEngine, getUtilizationRate } = require('../../src/lib/capacityEngine'); // Import the function to test
const { selectAsset } = require('../../src/store/selectors');
const mockStore = require('../mocks/store');

const { BigNumber } = ethers;
const { parseEther } = ethers.utils;
const { Zero } = ethers.constants;

describe('Capacity Engine tests', function () {
  describe('capacityEngine', function () {
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
        expect(product.utilizationRate.toNumber()).to.be.equal(capacities[i].utilizationRate);

        product.availableCapacity.forEach(({ assetId, amount, asset }, j) => {
          expect(amount.toString()).to.be.equal(capacities[i].availableCapacity[j].amount);
          expect(asset).to.deep.equal(selectAsset(store, assetId));
        });
      });
    });

    it('should return capacity for 1 product across all pools if productId is provided and poolId is not', function () {
      const productId = '0';
      const [product] = capacityEngine(store, { productIds: [productId] });

      const expectedCapacity = capacities[Number(productId)];

      expect(product.productId).to.be.equal(expectedCapacity.productId);
      expect(product.utilizationRate.toNumber()).to.be.equal(expectedCapacity.utilizationRate);

      product.availableCapacity.forEach(({ assetId, amount, asset }, i) => {
        expect(amount.toString()).not.to.be.equal(expectedCapacity.availableCapacity[i]);
        expect(asset).to.deep.equal(selectAsset(store, assetId));
      });
    });

    it('should return undefined for non-existing product', function () {
      const nonExistingProductId = '999';
      const [product] = capacityEngine(store, { productIds: [nonExistingProductId] });
      expect(product).to.be.equal(undefined);
    });

    it('should return capacity for a specific product and pool if both productId and poolId are provided', function () {
      const productId = '0';
      const poolId = 2;
      const [product] = capacityEngine(store, { poolId, productIds: [productId] });

      const expectedCapacity = poolProductCapacities[poolId].find(c => c.productId === Number(productId));

      expect(product.productId).to.equal(Number(productId));
      expect(product.usedCapacity.toString()).to.equal(expectedCapacity.allocatedNxm);
      expect(product.utilizationRate.toNumber()).to.be.equal(expectedCapacity.utilizationRate);
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
        expect(product.utilizationRate.toNumber()).to.be.equal(expectedCapacity.utilizationRate);
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
        acc.minAnnualPrice = acc.minAnnualPrice.gt(product.minAnnualPrice)
          ? acc.minAnnualPrice
          : product.minAnnualPrice;
        acc.maxAnnualPrice = acc.maxAnnualPrice.gt(product.maxAnnualPrice)
          ? acc.maxAnnualPrice
          : product.maxAnnualPrice;

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
      const utilizationRate = getUtilizationRate(summedCapacity.availableCapacity, summedCapacity.usedCapacity);
      expect(summedCapacity.productId).to.equal(allPoolsProduct.productId);
      expect(summedCapacity.usedCapacity.toString()).to.equal(allPoolsProduct.usedCapacity.toString());
      expect(utilizationRate.toNumber()).to.be.equal(allPoolsProduct.utilizationRate.toNumber());
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

  describe('getUtilizationRate tests', function () {
    it('should calculate utilization rate correctly when there is available capacity', function () {
      const capacityInAssets = [{ assetId: 255, amount: parseEther('100'), asset: assets[255] }];
      const capacityUsedNXM = parseEther('50');

      const utilizationRate = getUtilizationRate(capacityInAssets, capacityUsedNXM);

      const expectedRate = BigNumber.from(3333); // (50 / (100 + 50)) * 10000 = 3333 basis points

      expect(utilizationRate.toNumber()).to.be.closeTo(expectedRate.toNumber(), 1);
    });

    it('should return 1 when ALL capacity is used (no available capacity)', function () {
      const capacityInAssets = [{ assetId: 255, amount: Zero, asset: assets[255] }];
      const capacityUsedNXM = parseEther('150');

      const utilizationRate = getUtilizationRate(capacityInAssets, capacityUsedNXM);

      expect(utilizationRate.toNumber()).to.equal(10000);
    });

    it('should handle multiple assets and return the correct utilization rate', function () {
      const capacityInAssets = [
        { assetId: 255, amount: parseEther('200'), asset: assets[255] },
        { assetId: 1, amount: parseEther('100'), asset: assets[1] },
      ];
      const capacityUsedNXM = parseEther('100');

      const utilizationRate = getUtilizationRate(capacityInAssets, capacityUsedNXM);

      const expectedRate = BigNumber.from(3333); // (100 / (200 + 100)) * 10000 = 3333 basis points

      expect(utilizationRate.toNumber()).to.be.closeTo(expectedRate.toNumber(), 1);
    });

    it('should return undefined if utilizationRate cannot be calculated because of missing data', function () {
      // missing capacity in NXM (255)
      const capacityInAssets = [{ assetId: 1, amount: parseEther('100'), asset: assets[1] }];
      const capacityUsedNXM = parseEther('50');

      const utilizationRate = getUtilizationRate(capacityInAssets, capacityUsedNXM);

      expect(utilizationRate).to.equal(undefined);
    });

    it('should return undefined when there is no capacity available', function () {
      const capacityInAssets = [{ assetId: 255, amount: Zero, asset: assets[255] }];
      const capacityUsedNXM = Zero;

      const utilizationRate = getUtilizationRate(capacityInAssets, capacityUsedNXM);

      expect(utilizationRate.toNumber()).to.equal(0);
    });
  });
});
