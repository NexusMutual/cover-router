// NOTE: this must be updated if reducer.js initialState.assets is updated
const assets = {
  0: { id: 0, symbol: 'ETH', decimals: 18 },
  1: { id: 1, symbol: 'DAI', decimals: 18 },
  6: { id: 6, symbol: 'USDC', decimals: 6 },
  7: { id: 7, symbol: 'cbBTC', decimals: 8 },
  255: { id: 255, symbol: 'NXM', decimals: 18 },
};

// capacities response for product across ALL pools
const capacities = [
  {
    productId: 0,
    allocatedNxm: '364800000000000000000',
    maxAnnualPrice: '0.02',
    minAnnualPrice: '0.02',
    availableCapacity: [
      {
        assetId: 0,
        amount: '4756985850516546336',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '13291946909255031471651',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '13291946902',
        asset: assets[6],
      },
      {
        assetId: 7,
        amount: '38071470',
        asset: assets[7],
      },
      {
        assetId: 255,
        amount: '462740000000000000000',
        asset: assets[255],
      },
    ],
  },
  {
    productId: 1,
    allocatedNxm: '0',
    maxAnnualPrice: '0.02',
    minAnnualPrice: '0.02',
    availableCapacity: [
      {
        assetId: 0,
        amount: '5262352631887064160',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '14704040331174418918482',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '14704040324',
        asset: assets[6],
      },
      {
        assetId: 7,
        amount: '42116060',
        asset: assets[7],
      },
      {
        assetId: 255,
        amount: '511900000000000000000',
        asset: assets[255],
      },
    ],
  },
  {
    productId: 2,
    allocatedNxm: '0',
    maxAnnualPrice: '0.02',
    minAnnualPrice: '0.02',
    availableCapacity: [
      {
        assetId: 0,
        amount: '4756985850516546336',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '13291946909255031471651',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '13291946902',
        asset: assets[6],
      },
      {
        assetId: 7,
        amount: '38071470',
        asset: assets[7],
      },
      {
        assetId: 255,
        amount: '462740000000000000000',
        asset: assets[255],
      },
    ],
  },
  {
    productId: 3,
    availableCapacity: [
      {
        assetId: 0,
        amount: '650305069624035537600',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '1817079287575234550428386',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '1817079286701',
        asset: assets[6],
      },
      {
        assetId: 7,
        amount: '5204570966',
        asset: assets[7],
      },
      {
        assetId: 255,
        amount: '63259000000000000000000',
        asset: assets[255],
      },
    ],
    allocatedNxm: '32725200000000000000000',
    minAnnualPrice: '0.0775',
    maxAnnualPrice: '0.089219729208492072',
  },
  {
    productId: 4,
    availableCapacity: [
      {
        assetId: 0,
        amount: '37190101809685157280',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '103916403020296337803075',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '103916402970',
        asset: assets[6],
      },
      {
        assetId: 7,
        amount: '297642649',
        asset: assets[7],
      },
      {
        assetId: 255,
        amount: '3617700000000000000000',
        asset: assets[255],
      },
    ],
    allocatedNxm: '20004610000000000000000',
    maxAnnualPrice: '0.02',
    minAnnualPrice: '0.02',
  },
];

const productCapacityPerPools = {
  // productId 0
  0: [
    {
      allocatedNxm: '0',
      availableCapacity: [
        {
          amount: '1010527961934945120',
          asset: {
            decimals: 18,
            id: 0,
            symbol: 'ETH',
          },
          assetId: 0,
        },
        {
          amount: '2823612355058498495188',
          asset: {
            decimals: 18,
            id: 1,
            symbol: 'DAI',
          },
          assetId: 1,
        },
        {
          amount: '2823612353',
          asset: {
            decimals: 6,
            id: 6,
            symbol: 'USDC',
          },
          assetId: 6,
        },
        {
          amount: '8087534',
          asset: {
            decimals: 8,
            id: 7,
            symbol: 'cbBTC',
          },
          assetId: 7,
        },
        {
          amount: '98300000000000000000',
          asset: {
            decimals: 18,
            id: 255,
            symbol: 'NXM',
          },
          assetId: 255,
        },
      ],
      maxAnnualPrice: '0.02',
      minAnnualPrice: '0.02',
      poolId: 1,
    },
    {
      allocatedNxm: '0',
      availableCapacity: [
        {
          amount: '3746457888581601216',
          asset: {
            decimals: 18,
            id: 0,
            symbol: 'ETH',
          },
          assetId: 0,
        },
        {
          amount: '10468334554196532976463',
          asset: {
            decimals: 18,
            id: 1,
            symbol: 'DAI',
          },
          assetId: 1,
        },
        {
          amount: '10468334549',
          asset: {
            decimals: 6,
            id: 6,
            symbol: 'USDC',
          },
          assetId: 6,
        },
        {
          amount: '29983936',
          asset: {
            decimals: 8,
            id: 7,
            symbol: 'cbBTC',
          },
          assetId: 7,
        },
        {
          amount: '364440000000000000000',
          asset: {
            decimals: 18,
            id: 255,
            symbol: 'NXM',
          },
          assetId: 255,
        },
      ],
      maxAnnualPrice: '0.02',
      minAnnualPrice: '0.02',
      poolId: 2,
    },
    {
      allocatedNxm: '364800000000000000000',
      availableCapacity: [],
      maxAnnualPrice: '0.0',
      minAnnualPrice: '0.0',
      poolId: 3,
    },
  ],
};

// capacities response for product by pool
const poolProductCapacities = {
  // poolId 2
  2: {
    poolId: 2,
    utilizationRate: 0,
    productsCapacity: [
      {
        productId: 0,
        availableCapacity: [
          {
            assetId: 0,
            amount: '3746457888581601216',
            asset: { id: 0, symbol: 'ETH', decimals: 18 },
          },
          {
            assetId: 1,
            amount: '10468334554196532976463',
            asset: { id: 1, symbol: 'DAI', decimals: 18 },
          },
          {
            assetId: 6,
            amount: '10468334549',
            asset: { id: 6, symbol: 'USDC', decimals: 6 },
          },
          {
            assetId: 7,
            amount: '29983936',
            asset: { id: 7, symbol: 'cbBTC', decimals: 8 },
          },
          {
            assetId: 255,
            amount: '364440000000000000000',
            asset: { id: 255, symbol: 'NXM', decimals: 18 },
          },
        ],
        allocatedNxm: '0',
        minAnnualPrice: '0.02',
        maxAnnualPrice: '0.02',
      },
      {
        productId: 1,
        availableCapacity: [
          {
            assetId: 0,
            amount: '3746457888581601216',
            asset: { id: 0, symbol: 'ETH', decimals: 18 },
          },
          {
            assetId: 1,
            amount: '10468334554196532976463',
            asset: { id: 1, symbol: 'DAI', decimals: 18 },
          },
          {
            assetId: 6,
            amount: '10468334549',
            asset: { id: 6, symbol: 'USDC', decimals: 6 },
          },
          {
            assetId: 7,
            amount: '29983936',
            asset: { id: 7, symbol: 'cbBTC', decimals: 8 },
          },
          {
            assetId: 255,
            amount: '364440000000000000000',
            asset: { id: 255, symbol: 'NXM', decimals: 18 },
          },
        ],
        allocatedNxm: '0',
        minAnnualPrice: '0.02',
        maxAnnualPrice: '0.02',
      },
      {
        productId: 2,
        availableCapacity: [
          {
            assetId: 0,
            amount: '3746457888581601216',
            asset: { id: 0, symbol: 'ETH', decimals: 18 },
          },
          {
            assetId: 1,
            amount: '10468334554196532976463',
            asset: { id: 1, symbol: 'DAI', decimals: 18 },
          },
          {
            assetId: 6,
            amount: '10468334549',
            asset: { id: 6, symbol: 'USDC', decimals: 6 },
          },
          {
            assetId: 7,
            amount: '29983936',
            asset: { id: 7, symbol: 'cbBTC', decimals: 8 },
          },
          {
            assetId: 255,
            amount: '364440000000000000000',
            asset: { id: 255, symbol: 'NXM', decimals: 18 },
          },
        ],
        allocatedNxm: '0',
        minAnnualPrice: '0.02',
        maxAnnualPrice: '0.02',
      },
    ],
  },
};

const ethQuote = {
  totalCoverAmountInAsset: '100024792163041872',
  annualPrice: '200',
  premiumInNXM: '194600000000000000',
  premiumInAsset: '2000495843260837',
  refundInNXM: '0',
  refundInAsset: '0',
  premiumInNXMWithRefund: '194600000000000000',
  premiumInAssetWithRefund: '2000495843260837',
  poolAllocationRequests: [
    {
      poolId: '1',
      coverAmountInAsset: '100024792163041872',
    },
  ],
};

const daiQuote = {
  totalCoverAmountInAsset: '1148977560552796946',
  annualPrice: '200',
  premiumInNXM: '800000000000000',
  premiumInAsset: '22979551211055938',
  refundInNXM: '0',
  refundInAsset: '0',
  premiumInNXMWithRefund: '800000000000000',
  premiumInAssetWithRefund: '22979551211055938',
  poolAllocationRequests: [
    {
      poolId: '1',
      coverAmountInAsset: '1148977560552796946',
    },
  ],
};

const usdcQuote = {
  totalCoverAmountInAsset: '10053553',
  annualPrice: '200',
  premiumInNXM: '7000000000000000',
  premiumInAsset: '201071',
  refundInNXM: '0',
  refundInAsset: '0',
  premiumInNXMWithRefund: '7000000000000000',
  premiumInAssetWithRefund: '201071',
  poolAllocationRequests: [
    {
      poolId: '1',
      coverAmountInAsset: '10053553',
    },
  ],
};

const quoteMapping = {
  0: ethQuote,
  1: daiQuote,
  6: usdcQuote,
};

const getQuote = assetId => ({
  quote: {
    ...quoteMapping[assetId],
    asset: assets[assetId],
  },
});

module.exports = {
  assets,
  capacities,
  poolProductCapacities,
  productCapacityPerPools,
  getQuote,
};
