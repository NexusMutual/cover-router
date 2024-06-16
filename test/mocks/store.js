const { BigNumber } = require('ethers');

const store = {
  assetRates: {
    0: BigNumber.from(10280040304526400n),
    1: BigNumber.from(28724439013819923654n),
    6: BigNumber.from(28724439n),
    255: BigNumber.from(1000000000000000000n),
  },
  assets: {
    0: { id: 0, symbol: 'ETH', decimals: 18 },
    1: { id: 1, symbol: 'DAI', decimals: 18 },
    6: { id: 6, symbol: 'USDC', decimals: 6 },
    255: { id: 255, symbol: 'NXM', decimals: 18 },
  },
  productPriorityPoolsFixedPrice: {
    186: [18, 22, 1],
  },
  globalCapacityRatio: BigNumber.from(20000),
  poolProducts: {
    '0_1': {
      productId: 0,
      poolId: 1,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
      ],
      trancheCapacities: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(9840),
      ],
      lastEffectiveWeight: BigNumber.from(0),
      targetWeight: BigNumber.from(40),
      targetPrice: BigNumber.from(200),
      bumpedPrice: BigNumber.from(100),
      bumpedPriceUpdateTime: BigNumber.from(1678700054),
    },
    '0_2': {
      productId: 0,
      poolId: 2,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
      ],
      trancheCapacities: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(36480),
      ],
      lastEffectiveWeight: BigNumber.from(0),
      targetWeight: BigNumber.from(40),
      targetPrice: BigNumber.from(200),
      bumpedPrice: BigNumber.from(100),
      bumpedPriceUpdateTime: BigNumber.from(1678700055),
    },
    '0_3': {
      productId: 0,
      poolId: 3,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(36480),
      ],
      trancheCapacities: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(36480),
      ],
      lastEffectiveWeight: BigNumber.from(0),
      targetWeight: BigNumber.from(40),
      targetPrice: BigNumber.from(200),
      bumpedPrice: BigNumber.from(100),
      bumpedPriceUpdateTime: BigNumber.from(1678700055),
    },
    '1_1': {
      productId: 1,
      poolId: 1,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
      ],
      trancheCapacities: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(14760),
      ],
      lastEffectiveWeight: BigNumber.from(0),
      targetWeight: BigNumber.from(20),
      targetPrice: BigNumber.from(200),
      bumpedPrice: BigNumber.from(100),
      bumpedPriceUpdateTime: BigNumber.from(1678700054),
    },
    '1_2': {
      productId: 1,
      poolId: 2,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
      ],
      trancheCapacities: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(36480),
      ],
      lastEffectiveWeight: BigNumber.from(0),
      targetWeight: BigNumber.from(20),
      targetPrice: BigNumber.from(200),
      bumpedPrice: BigNumber.from(100),
      bumpedPriceUpdateTime: BigNumber.from(1678700055),
    },
    '2_1': {
      productId: 2,
      poolId: 1,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
      ],
      trancheCapacities: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(9840),
      ],
      lastEffectiveWeight: BigNumber.from(0),
      targetWeight: BigNumber.from(40),
      targetPrice: BigNumber.from(200),
      bumpedPrice: BigNumber.from(100),
      bumpedPriceUpdateTime: BigNumber.from(1678700054),
    },
    '2_2': {
      productId: 2,
      poolId: 2,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
      ],
      trancheCapacities: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(36480),
      ],
      lastEffectiveWeight: BigNumber.from(0),
      targetWeight: BigNumber.from(40),
      targetPrice: BigNumber.from(200),
      bumpedPrice: BigNumber.from(100),
      bumpedPriceUpdateTime: BigNumber.from(1678700055),
    },
    '3_4': {
      productId: 3,
      poolId: 4,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(1475865),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
      ],
      trancheCapacities: [
        BigNumber.from(0),
        BigNumber.from(1642753),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
      ],
      lastEffectiveWeight: BigNumber.from(50),
      targetWeight: BigNumber.from(50),
      targetPrice: BigNumber.from(800),
      bumpedPrice: BigNumber.from(2596),
      bumpedPriceUpdateTime: BigNumber.from(1712042675),
    },
    '3_5': {
      productId: 3,
      poolId: 5,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(182069),
        BigNumber.from(1948),
        BigNumber.from(849),
        BigNumber.from(0),
        BigNumber.from(1087193),
        BigNumber.from(0),
        BigNumber.from(0),
      ],
      trancheCapacities: [
        BigNumber.from(4566),
        BigNumber.from(182069),
        BigNumber.from(1948),
        BigNumber.from(849),
        BigNumber.from(0),
        BigNumber.from(1173144),
        BigNumber.from(4925),
        BigNumber.from(0),
      ],
      lastEffectiveWeight: BigNumber.from(7),
      targetWeight: BigNumber.from(7),
      targetPrice: BigNumber.from(800),
      bumpedPrice: BigNumber.from(2617),
      bumpedPriceUpdateTime: BigNumber.from(1711690559),
    },
    '3_6': {
      productId: 3,
      poolId: 6,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
      ],
      trancheCapacities: [
        BigNumber.from(226500),
        BigNumber.from(49999),
        BigNumber.from(0),
        BigNumber.from(1557499),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(1200499),
        BigNumber.from(2850000),
      ],
      lastEffectiveWeight: BigNumber.from(25),
      targetWeight: BigNumber.from(25),
      targetPrice: BigNumber.from(900),
      bumpedPrice: BigNumber.from(750),
      bumpedPriceUpdateTime: BigNumber.from(1712060567),
    },
    '3_7': {
      productId: 3,
      poolId: 7,
      allocations: [
        BigNumber.from(0),
        BigNumber.from(0x061a7f),
        BigNumber.from(0x01e6b5),
        BigNumber.from(0x00),
        BigNumber.from(0x00),
        BigNumber.from(0x00),
        BigNumber.from(0x00),
        BigNumber.from(0x00),
      ],
      trancheCapacities: [
        BigNumber.from(0),
        BigNumber.from(509999),
        BigNumber.from(200000),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
      ],
      lastEffectiveWeight: BigNumber.from(50),
      targetWeight: BigNumber.from(50),
      targetPrice: BigNumber.from(775),
      bumpedPrice: BigNumber.from(1369),
      bumpedPriceUpdateTime: BigNumber.from(1712177207),
    },
  },
  productPoolIds: {
    0: [1, 2, 3],
    1: [1, 2],
    2: [1, 2],
    3: [4, 5, 6, 7],
  },
  products: {
    0: {
      productType: 0, // Protocol Cover
      capacityReductionRatio: 0,
      useFixedPrice: false,
      gracePeriod: 30,
      id: 0,
    },
    1: {
      productType: 0, // Protocol Cover
      capacityReductionRatio: 0,
      useFixedPrice: false,
      gracePeriod: 30,
      id: 1,
    },
    2: {
      productType: 0, // Protocol Cover
      capacityReductionRatio: 0,
      useFixedPrice: true,
      gracePeriod: 30,
      id: 2,
    },
    3: {
      productType: 11, //  Bundled Protocol Cover
      capacityReductionRatio: 0,
      useFixedPrice: false,
      gracePeriod: 3024000,
      isDeprecated: false,
      id: 3,
    },
  },
  trancheId: 213,
};

module.exports = store;
