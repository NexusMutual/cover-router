const data = require('./store');

const chainApiMock = {
  fetchProducts: async () => {
    return data.products;
  },

  fetchProduct: async productId => {
    const product = { ...data.products[productId] };
    delete product.id;
    return product;
  },

  fetchProductPoolsIds: async productId => {
    return data.productPoolIds[productId];
  },

  fetchPoolProductIds: async poolId => {
    Object.entries(data.productPoolIds).reduce((acc, [productId, poolIds]) => {
      if (poolIds.includes(poolId)) {
        acc.push(productId);
      }
      return acc;
    }, []);
  },

  fetchGlobalCapacityRatio: async () => {
    return data.globalCapacityRatio;
  },

  fetchStakingPoolCount: async () => {
    return [...new Set(Object.value(data.productPoolIds).flat())].length;
  },

  fetchProductCount: async () => {
    return Object.keys(data.products).length;
  },

  fetchPoolProduct: async (productId, poolId, globalCapacityRatio, capacityReductionRatio) => {
    const poolProduct = { ...data.poolProducts[`${productId}_${poolId}`] };
    delete poolProduct.productId;
    delete poolProduct.poolId;
    return poolProduct;
  },

  fetchTokenPriceInAsset: async assetId => {
    return data.assetRates[assetId];
  },
};

module.exports = chainApiMock;
