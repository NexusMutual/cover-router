const { abis } = require('@nexusmutual/deployments');
const { ethers } = require('ethers');

const { BEACON_PROXY_INIT_CODE_HASH } = require('./constants');

/**
 * CREATE2 address for a beacon-proxy staking pool instance derived from `StakingPoolFactory` and pool id.
 *
 * @param {string} factoryAddress - `StakingPoolFactory` deployment address.
 * @param {number|string|BigNumber} id - Pool id used as salt.
 * @returns {string} Checksummed pool contract address.
 */
function calculateAddress(factoryAddress, id) {
  const hexPoolId = ethers.BigNumber.from(id).toHexString().slice(2);
  const salt = Buffer.from(hexPoolId.padStart(64, '0'), 'hex');
  const initCodeHash = Buffer.from(BEACON_PROXY_INIT_CODE_HASH, 'hex');
  return ethers.utils.getCreate2Address(factoryAddress, salt, initCodeHash);
}

/**
 * Returns a memoized contract accessor: core Nexus Mutual contracts by name, staking pools by id (CREATE2).
 *
 * @param {Object} addresses - Deployment addresses map (`Cover`, `StakingPoolFactory`, …).
 * @param {import('ethers').providers.Provider} provider
 * @returns {(name: string, id?: number, forceNew?: boolean) => import('ethers').Contract}
 */
module.exports = (addresses, provider) => {
  const instances = {};

  return (name, id = 0, forceNew = false) => {
    const isStakingPool = name === 'StakingPool';
    const key = `${name}-${isStakingPool ? id : 0}`;

    if (!addresses[name] && !isStakingPool) {
      throw new Error(`Contract ${name} not found`);
    }

    const address = isStakingPool
      ? calculateAddress(addresses.StakingPoolFactory, id) // staking pool
      : addresses[name]; // regular contract

    if (!instances[key] || forceNew) {
      const abi = abis[name];
      instances[key] = new ethers.Contract(address, abi, provider);
    }

    return instances[key];
  };
};
