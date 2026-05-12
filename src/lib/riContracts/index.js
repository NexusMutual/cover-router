const { ethers } = require('ethers');

const data = require('./data.json');
const delegator = require('./Delegator.json');
const slasher = require('./Slasher.json');
const vault = require('./Vault.json');

/**
 * Instantiates RI/Symbiotic vault, delegator, slasher, and asset helper contracts from bundled deployment metadata.
 *
 * @param {import('ethers').providers.Provider} provider
 * @returns {Object<string, *>} Keys like `vault_*`, `delegator_*`, `asset_*`; values are `Contract` instances or
 *   `{ getRate, protocolAssetCorrelationId }` for assets.
 */
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
      quoteAssetId: assets[key].quoteAssetId,
    };
  }

  return symbiotic;
};
