const { ethers } = require('ethers');
const { abis } = require('@nexusmutual/sdk');
const { BEACON_PROXY_INIT_CODE_HASH } = require('./constants');

function calculateAddress(factoryAddress, id) {
  const hexPoolId = ethers.BigNumber.from(id).toHexString().slice(2);
  const salt = Buffer.from(hexPoolId.padStart(64, '0'), 'hex');
  const initCodeHash = Buffer.from(BEACON_PROXY_INIT_CODE_HASH, 'hex');
  return ethers.utils.getCreate2Address(factoryAddress, salt, initCodeHash);
}

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
