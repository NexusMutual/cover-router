const ethers = require('ethers');

module.exports = {
  CONTRACTS_ADDRESSES: {
    Assessment: '0x4826533B4897376654Bb4d4AD88B7faFD0C98528',
    Cover: '0xc6e7DF5E7b4f2A278906862b61205850344D4e7d',
    CoverMigrator: '0x0E801D84Fa97b50751Dbf25036d067dCf18858bF',
    CoverNFT: '0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f',
    CoverViewer: '0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9',
    'Chainlink-DAI-ETH': '0x4c5859f0F772848b2D91F1D83E2Fe57935348029',
    'Chainlink-STETH-ETH': '0x5f3f1dBD7B74C6B46e8c44f98792A1dAf8d69154',
    'Chainlink-ENZYME-VAULT': '0xCD8a1C3ba11CF5ECfa6267617243239504a98d90',
    'Chainlink-ETH-USD': '0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3',
    DAI: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    stETH: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    enzymeVault: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    ERC20Mock: '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c',
    Governance: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
    IndividualClaims: '0x998abeb3E57409262aE5b751f60747921B33613E',
    LegacyClaimsReward: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
    LegacyGateway: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
    LegacyPooledStaking: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    MCR: '0xFD471836031dc5108809D173A067e8486B9047A3',
    MemberRoles: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
    NXMaster: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
    NXMToken: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    Pool: '0x1429859428C0aBc9C2C47C8Ee9FBaf82cFA0F20f',
    PriceFeedOracle: '0x7bc06c482DEAd17c0e297aFbC32f6e63d3846650',
    ProductsV1: '0x68B1D87F95878fE05B998F19b66F4baba5De1aed',
    ProposalCategory: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
    SOMockSettlement: '0x36C02dA8a0983159322a80FFE9F24b1acfF8B570',
    SOMockVaultRelayer: '0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00',
    StakingNFT: '0x4A679253410272dd5232B3Ff7cF5dbB88f295319',
    StakingPoolFactory: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
    StakingProducts: '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1',
    StakingViewer: '0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8',
    Stub: '0x59b670e9fA9D0A427751Af201D676719a970857b',
    SwapOperator: '0x809d550fca64d94Bd9F66E60752A544199cfAC3D',
    LegacyClaimProofs: '0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf',
    LegacyClaimsData: '0x9d4454B023096f34B160D6B654540c56A1F81688',
    LegacyQuotationData: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
    TokenController: '0x67d269191c92Caf3cD7723F116c85e6E9bf55933',
    YieldTokenIncidents: '0xf5059a5D33d5853360D16C683c16e67980206f36',
  },
  INIT_CODE_HASH: '203b477dc328f1ceb7187b20e5b1b0f0bc871114ada7e9020c9ac112bbfb6920',
  STAKING_POOL_STARTING_ID: 0,
  TRANCHE_DURATION_DAYS: 91,
  SURGE_PRICE_RATIO: 2, // ether,
  SURGE_THRESHOLD_RATIO: 0.9, // 90.00%
  SURGE_THRESHOLD_DENOMINATOR: 100, // 100.00%
  // base price bump
  // +0.2% for each 1% of capacity used, ie +20% for 100%
  PRICE_BUMP_RATIO: 20_00, // 20%
  // bumped price smoothing
  // 0.5% per day
  PRICE_CHANGE_PER_DAY: 50, // 0.5%
  INITIAL_PRICE_DENOMINATOR: 100_00,
  TARGET_PRICE_DENOMINATOR: 100_00,
  MAX_TOTAL_WEIGHT: 20_00, // 20x

  MAX_ACTIVE_TRANCHES: 8, // 7 whole quarters + 1 partial quarter
  WEIGHT_DENOMINATOR: 100,
  ONE_NXM: ethers.utils.parseEther('1'),
  ALLOCATION_UNITS_PER_NXM: 100,

  NXM_PER_ALLOCATION_UNIT: ethers.utils.parseEther('1').div(100),

  MIN_COVER_PERIOD: 28, // days
  ASSET_ID: {
    ETH: 0,
    DAI: 1,
  },
};
