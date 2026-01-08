const { ethers } = require('ethers');

const data = require('./data.json');
const delegator = require('./Delegator.json');
const slasher = require('./Slasher.json');
const vault = require('./Vault.json');

module.exports = provider => {
  const { vaults, delegators, slashers, assets } = data;

  console.log(vaults);
  const symbiotic = {};

  for (const key in vaults) {
    symbiotic[`vault_${key}`] = new ethers.Contract(vaults[key], vault, provider);
    symbiotic[`delegator_${key}`] = new ethers.Contract(delegators[key], delegator, provider);
    symbiotic[`slasher_${key}`] = new ethers.Contract(slashers[key], slasher, provider);
  }

  for (const key in assets) {
    const contract = new ethers.Contract(assets[key].address, assets[key].abi, provider);
    symbiotic[`asset_${key}`] = {
      getRate: async () => contract[assets[key].method](),
      protocolAssetCorrelationId: assets[key].protocolAssetCorrelationId,
    };
  }

  return symbiotic;
};
