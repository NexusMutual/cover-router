const { expect } = require('chai');

const { selectProductPools, selectProductsInPool } = require('../../src/store/selectors');
const mockStore = require('../mocks/store');

describe('selectProductPools', function () {
  let store;

  before(function () {
    store = { getState: () => mockStore };
  });

  it('should return an empty array when productId is not found', function () {
    const nonExistentProductId = 999;
    const result = selectProductPools(store, nonExistentProductId);

    expect(result).to.have.lengthOf(0);
  });

  it('should return an empty array when poolId is provided but not found', function () {
    const productId = 0;
    const nonExistentPoolId = 999;
    const result = selectProductPools(store, productId, nonExistentPoolId);

    expect(result).to.have.lengthOf(0);
  });

  it('should return a specific pool for a product when poolId is provided', function () {
    const productId = 0;
    const existingPoolId = 2;
    const [poolProduct] = selectProductPools(store, productId, existingPoolId);

    expect(poolProduct).to.deep.equal(mockStore.poolProducts['0_2']);
  });

  it('should return all pools for a product when poolId is not provided', function () {
    const productId = 0;
    const [poolProduct1, poolProduct2, poolProduct3] = selectProductPools(store, productId);

    expect(poolProduct1).to.deep.equal(mockStore.poolProducts['0_1']);
    expect(poolProduct2).to.deep.equal(mockStore.poolProducts['0_2']);
    expect(poolProduct3).to.deep.equal(mockStore.poolProducts['0_3']);
  });

  it('should return pools in the correct custom priority order for specific products', function () {
    const productIdWithCustomPoolOrder = 4;
    const result = selectProductPools(store, productIdWithCustomPoolOrder);

    expect(result).to.have.lengthOf(3);
    const expectedPoolIds = mockStore.productPoolIds[productIdWithCustomPoolOrder];
    expect(result.map(pool => pool.poolId)).to.deep.equal(expectedPoolIds);
  });
});

describe('selectProductsInPool', function () {
  let store;

  before(function () {
    store = { getState: () => mockStore };
  });

  it('should return all products in a specific pool', function () {
    const poolId = 1;
    const { productPoolIds } = store.getState();
    const products = selectProductsInPool(store, poolId);

    // Check against mock store data
    const expectedProducts = Object.keys(productPoolIds).filter(productId =>
      productPoolIds[productId].includes(poolId),
    );

    expect(products).to.have.members(expectedProducts);
    expect(products).to.have.lengthOf(expectedProducts.length);
  });

  it('should return empty array for pool with no products', function () {
    const nonExistentPoolId = 999;
    const products = selectProductsInPool(store, nonExistentPoolId);
    expect(products).to.be.an('array');
    expect(products).to.have.lengthOf(0);
  });

  it('should handle string pool ids', function () {
    const poolId = '1';
    const { productPoolIds } = store.getState();
    const products = selectProductsInPool(store, poolId);

    const expectedProducts = Object.keys(productPoolIds).filter(productId =>
      productPoolIds[productId].includes(Number(poolId)),
    );

    expect(products).to.have.members(expectedProducts);
  });

  it('should handle invalid pool id', function () {
    const products = selectProductsInPool(store, -1);
    expect(products).to.be.an('array');
    expect(products).to.have.lengthOf(0);
  });

  it('should handle string vs number pool ids consistently', function () {
    const numericResult = selectProductsInPool(store, 1);
    const stringResult = selectProductsInPool(store, '1');
    expect(numericResult).to.deep.equal(stringResult);
  });

  it('should handle undefined productPools', function () {
    const emptyStore = {
      getState: () => ({
        products: { 1: {}, 2: {}, 3: {} },
        productPoolIds: {},
        poolProducts: {},
      }),
    };

    const poolId = 2;
    const result = selectProductsInPool(emptyStore, poolId);

    expect(result).to.deep.equal([]);
  });
});
