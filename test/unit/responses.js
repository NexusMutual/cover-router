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
      },
      {
        assetId: 1,
        amount: '13305160151201388636532',
      },
      {
        assetId: 255,
        amount: '463200000000000000000',
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
      },
      {
        assetId: 1,
        amount: '14718402550681328880309',
      },
      {
        assetId: 255,
        amount: '512400000000000000000',
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
      },
      {
        assetId: 1,
        amount: '13305160151201388636532',
      },
      {
        assetId: 255,
        amount: '463200000000000000000',
      },
    ],
  },
  {
    productId: 3,
    availableCapacity: [
      {
        assetId: 0,
        amount: '627202118245255087296',
      },
      {
        assetId: 1,
        amount: '1752525132313136206805332',
      },
      {
        assetId: 255,
        amount: '61011640000000000000000',
      },
    ],
    allocatedNxm: '32725200000000000000000',
    minAnnualPrice: '0.09',
    maxAnnualPrice: '0.112156212788396874',
  },
];

const quote = {
  quote: {
    annualPrice: '279',
    premiumInNXM: '2718347967479674796',
    premiumInAsset: '27944726667418476',
    totalCoverAmountInAsset: '1000042320824328192',
    poolAllocationRequests: [
      {
        poolId: '1',
        coverAmountInAsset: '1000042320824328192',
        skip: false,
      },
    ],
  },
  capacities: [
    {
      poolId: '1',
      capacity: [
        {
          assetId: '0',
          amount: '1011555965965397760',
        },
        {
          assetId: '1',
          amount: '2826484798959880487553',
        },
        {
          assetId: '255',
          amount: '98400000000000000000',
        },
      ],
    },
  ],
};

module.exports = {
  capacities,
  quote,
};
