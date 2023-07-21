const capacities = [
  {
    productId: 0,
    allocatedNxm: '364800000000000000000',
    annualPrice: '0.02',
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
    annualPrice: '0.02',
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
    annualPrice: '0.02',
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
];

const quote = {
  quote: {
    premiumInNXM: '2718347967479674796',
    premiumInAsset: '27944726667418476',
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

const usage = [
  {
    poolId: '1',
    products: [
      {
        productId: 0,
        capacityUsed: [
          {
            assetId: 0,
            amount: '0',
          },
          {
            assetId: 1,
            amount: '0',
          },
          {
            assetId: 255,
            amount: '0',
          },
        ],
      },
      {
        productId: 1,
        capacityUsed: [
          {
            assetId: 0,
            amount: '0',
          },
          {
            assetId: 1,
            amount: '0',
          },
          {
            assetId: 255,
            amount: '0',
          },
        ],
      },
      {
        productId: 2,
        capacityUsed: [
          {
            assetId: 0,
            amount: '0',
          },
          {
            assetId: 1,
            amount: '0',
          },
          {
            assetId: 255,
            amount: '0',
          },
        ],
      },
    ],
  },
  {
    poolId: '2',
    products: [
      {
        productId: 1,
        capacityUsed: [
          {
            assetId: 0,
            amount: '0',
          },
          {
            assetId: 1,
            amount: '0',
          },
          {
            assetId: 255,
            amount: '0',
          },
        ],
      },
      {
        productId: 2,
        capacityUsed: [
          {
            assetId: 0,
            amount: '0',
          },
          {
            assetId: 1,
            amount: '0',
          },
          {
            assetId: 255,
            amount: '0',
          },
        ],
      },
    ],
  },
  {
    poolId: '3',
    products: [
      {
        productId: 0,
        capacityUsed: [
          {
            assetId: 0,
            amount: '3750158703091230720',
          },
          {
            assetId: 1,
            amount: '10478675352241508148979',
          },
          {
            assetId: 255,
            amount: '364800000000000000000',
          },
        ],
      },
    ],
  },
];

module.exports = {
  capacities,
  quote,
  usage,
};
