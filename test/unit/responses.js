const capacities = [
  {
    productId: 0,
    capacity: [
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
    capacity: [
      {
        assetId: 0,
        amount: '2380857334528314240',
      },
      {
        assetId: 1,
        amount: '6652580075600694318266',
      },
      {
        assetId: 255,
        amount: '231600000000000000000',
      },
    ],
  },
  {
    productId: 2,
    capacity: [
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
    premiumInNXM: '200000000000000',
    premiumInAsset: '2056008060905',
    poolAllocationRequests: [
      {
        poolId: '1',
        coverAmountInAsset: '30000',
        skip: false,
      },
    ],
  },
  capacities: [
    {
      poolId: 1,
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
