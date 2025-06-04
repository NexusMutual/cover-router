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
        amount: '4756936506323084609',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '13291809031947765136018',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '13291809025',
        asset: assets[6],
      },
      {
        assetId: 7,
        amount: '38071075',
        asset: assets[7],
      },
      {
        assetId: 255,
        amount: '462735200000000000000',
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
        amount: '5262225159387288032',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '14703684148130647551429',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '14703684141',
        asset: assets[6],
      },
      {
        assetId: 7,
        amount: '42115040',
        asset: assets[7],
      },
      {
        assetId: 255,
        amount: '511887600000000000000',
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
        amount: '4756936506323084609',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '13291809031947765136018',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '13291809025',
        asset: assets[6],
      },
      {
        assetId: 7,
        amount: '38071075',
        asset: assets[7],
      },
      {
        assetId: 255,
        amount: '462735200000000000000',
        asset: assets[255],
      },
    ],
  },
  {
    productId: 3,
    availableCapacity: [
      {
        assetId: 0,
        amount: '650304840379136746661',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '1817078647020244542244088',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '1817078646146',
        asset: assets[6],
      },
      {
        assetId: 7,
        amount: '5204569131',
        asset: assets[7],
      },
      {
        assetId: 255,
        amount: '63258977700000000000000',
        asset: assets[255],
      },
    ],
    allocatedNxm: '32725200000000000000000',
    minAnnualPrice: '0.0775',
    maxAnnualPrice: '0.08921973183222972',
  },
  {
    productId: 4,
    availableCapacity: [
      {
        assetId: 0,
        amount: '37189969094364825844',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '103916032187788669387861',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '103916032137',
        asset: assets[6],
      },
      {
        assetId: 7,
        amount: '297641587',
        asset: assets[7],
      },
      {
        assetId: 255,
        amount: '3617687090000000000000',
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
          amount: '3746408544388139489',
          asset: {
            decimals: 18,
            id: 0,
            symbol: 'ETH',
          },
          assetId: 0,
        },
        {
          amount: '10468196676889266640830',
          asset: {
            decimals: 18,
            id: 1,
            symbol: 'DAI',
          },
          assetId: 1,
        },
        {
          amount: '10468196671',
          asset: {
            decimals: 6,
            id: 6,
            symbol: 'USDC',
          },
          assetId: 6,
        },
        {
          amount: '29983541',
          asset: {
            decimals: 8,
            id: 7,
            symbol: 'cbBTC',
          },
          assetId: 7,
        },
        {
          amount: '364435200000000000000',
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
            amount: '3746408544388139489',
            asset: { id: 0, symbol: 'ETH', decimals: 18 },
          },
          {
            assetId: 1,
            amount: '10468196676889266640830',
            asset: { id: 1, symbol: 'DAI', decimals: 18 },
          },
          {
            assetId: 6,
            amount: '10468196671',
            asset: { id: 6, symbol: 'USDC', decimals: 6 },
          },
          {
            assetId: 7,
            amount: '29983541',
            asset: { id: 7, symbol: 'cbBTC', decimals: 8 },
          },
          {
            assetId: 255,
            amount: '364435200000000000000',
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
            amount: '3746408544388139489',
            asset: { id: 0, symbol: 'ETH', decimals: 18 },
          },
          {
            assetId: 1,
            amount: '10468196676889266640830',
            asset: { id: 1, symbol: 'DAI', decimals: 18 },
          },
          {
            assetId: 6,
            amount: '10468196671',
            asset: { id: 6, symbol: 'USDC', decimals: 6 },
          },
          {
            assetId: 7,
            amount: '29983541',
            asset: { id: 7, symbol: 'cbBTC', decimals: 8 },
          },
          {
            assetId: 255,
            amount: '364435200000000000000',
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
            amount: '3746408544388139489',
            asset: { id: 0, symbol: 'ETH', decimals: 18 },
          },
          {
            assetId: 1,
            amount: '10468196676889266640830',
            asset: { id: 1, symbol: 'DAI', decimals: 18 },
          },
          {
            assetId: 6,
            amount: '10468196671',
            asset: { id: 6, symbol: 'USDC', decimals: 6 },
          },
          {
            assetId: 7,
            amount: '29983541',
            asset: { id: 7, symbol: 'cbBTC', decimals: 8 },
          },
          {
            assetId: 255,
            amount: '364435200000000000000',
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
  annualPrice: '200',
  premiumInNXM: '194600000000000000',
  premiumInAsset: '2000495843260837',
  totalCoverAmountInAsset: '100024792163041872',
  poolAllocationRequests: [
    {
      poolId: '1',
      coverAmountInAsset: '100024792163041872',
    },
  ],
};

const daiQuote = {
  annualPrice: '200',
  premiumInNXM: '800000000000000',
  premiumInAsset: '22979551211055938',
  totalCoverAmountInAsset: '1148977560552796946',
  poolAllocationRequests: [
    {
      poolId: '1',
      coverAmountInAsset: '1148977560552796946',
    },
  ],
};

const usdcQuote = {
  annualPrice: '200',
  premiumInNXM: '7000000000000000',
  premiumInAsset: '201071',
  totalCoverAmountInAsset: '10053553',
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
  capacities: [
    {
      poolId: '1',
      capacity: [
        {
          assetId: '0',
          amount: '1010527961934945120',
          asset: assets[0],
        },
        {
          assetId: '1',
          amount: '2823612355058498495188',
          asset: assets[1],
        },
        {
          assetId: '6',
          amount: '2823612353',
          asset: assets[6],
        },
        {
          assetId: '7',
          amount: '8087534',
          asset: assets[7],
        },
        {
          assetId: '255',
          amount: '98300000000000000000',
          asset: assets[255],
        },
      ],
    },
  ],
});

module.exports = {
  assets,
  capacities,
  poolProductCapacities,
  productCapacityPerPools,
  getQuote,
};
