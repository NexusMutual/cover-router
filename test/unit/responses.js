// NOTE: this must be updated if reducer.js initialState.assets is updated
const assets = {
  0: { id: 0, symbol: 'ETH', decimals: 18 },
  1: { id: 1, symbol: 'DAI', decimals: 18 },
  6: { id: 6, symbol: 'USDC', decimals: 6 },
  255: { id: 255, symbol: 'NXM', decimals: 18 },
};

const capacities = [
  {
    productId: 0,
    allocatedNxm: '364800000000000000000',
    maxAnnualPrice: '0.03',
    minAnnualPrice: '0.02',
    availableCapacity: [
      {
        assetId: 0,
        amount: '4761714669056628480',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '13305160151201388636532',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '13305160144',
        asset: assets[6],
      },
      {
        assetId: 255,
        amount: '463200000000000000000',
        asset: assets[255],
      },
    ],
  },
  {
    productId: 1,
    allocatedNxm: '0',
    maxAnnualPrice: '0.03',
    minAnnualPrice: '0.02',
    availableCapacity: [
      {
        assetId: 0,
        amount: '5267492652039327360',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '14718402550681328880309',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '14718402543',
        asset: assets[6],
      },
      {
        assetId: 255,
        amount: '512400000000000000000',
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
        amount: '4761714669056628480',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '13305160151201388636532',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '13305160144',
        asset: assets[6],
      },
      {
        assetId: 255,
        amount: '463200000000000000000',
        asset: assets[255],
      },
    ],
  },
  {
    productId: 3,
    availableCapacity: [
      {
        assetId: 0,
        amount: '650955796175312058720',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '1818897544564809351595684',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '1818897543689',
        asset: assets[6],
      },
      {
        assetId: 255,
        amount: '63322300000000000000000',
        asset: assets[255],
      },
    ],
    allocatedNxm: '32725200000000000000000',
    minAnnualPrice: '0.0775',
    maxAnnualPrice: '0.104190714614767679',
  },
  {
    productId: 4,
    availableCapacity: [
      {
        assetId: 0,
        amount: '37227212755184497584',
        asset: assets[0],
      },
      {
        assetId: 1,
        amount: '104020098245136227727466',
        asset: assets[1],
      },
      {
        assetId: 6,
        amount: '104020098195',
        asset: assets[6],
      },
      {
        assetId: 255,
        amount: '3621310000000000000000',
        asset: assets[255],
      },
    ],
    allocatedNxm: '20004610000000000000000',
    maxAnnualPrice: '0.077089706487431343',
    minAnnualPrice: '0.02',
  },
];

const ethQuote = {
  annualPrice: '199',
  premiumInNXM: '194600000000000000',
  premiumInAsset: '2000495843260837',
  totalCoverAmountInAsset: '100024792163041872',
  poolAllocationRequests: [
    {
      poolId: '1',
      coverAmountInAsset: '100024792163041872',
      skip: false,
    },
  ],
};

const daiQuote = {
  annualPrice: '199',
  premiumInNXM: '800000000000000',
  premiumInAsset: '22979551211055938',
  totalCoverAmountInAsset: '1148977560552796946',
  poolAllocationRequests: [
    {
      poolId: '1',
      coverAmountInAsset: '1148977560552796946',
      skip: false,
    },
  ],
};

const usdcQuote = {
  annualPrice: '199',
  premiumInNXM: '7000000000000000',
  premiumInAsset: '201071',
  totalCoverAmountInAsset: '10053553',
  poolAllocationRequests: [
    {
      poolId: '1',
      coverAmountInAsset: '10053553',
      skip: false,
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
          amount: '1011555965965397760',
          asset: assets[0],
        },
        {
          assetId: '1',
          amount: '2826484798959880487553',
          asset: assets[1],
        },
        {
          assetId: '6',
          amount: '2826484797',
          asset: assets[6],
        },
        {
          assetId: '255',
          amount: '98400000000000000000',
          asset: assets[255],
        },
      ],
    },
  ],
});

module.exports = {
  capacities,
  getQuote,
};
