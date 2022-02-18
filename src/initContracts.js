require('dotenv').config();

const fetch = require('node-fetch');
const ethers = require('ethers');

const fetchVersionData = async () => {
  const chain = process.env.CHAIN;
  const versionDataUrl = process.env.VERSION_DATA_URL;
  let data = await fetch(versionDataUrl).then(res => res.json());

  if (typeof data[chain] === 'undefined') {
    throw new Error(`No data for ${chain} chain found.`);
  }

  data = data[chain].abis.reduce(
    (data, abi) => ({
      ...data,
      [abi.code]: { ...abi, contractAbi: JSON.parse(abi.contractAbi) },
    }),
    {},
  );

  return data;
};

const getContract = (code, provider, versionData) =>
  new ethers.Contract(
    versionData[code].address,
    versionData[code].contractAbi,
    provider,
  );

const instanceOf = {};

const initContracts = async (codes, provider) => {
  const versionData = await fetchVersionData();
  const contracts = codes.reduce(
    (acc, code) => ({
      ...acc,
      [code]: getContract(code, provider, versionData),
    }),
    {},
  );

  codes.forEach(code => {
    instanceOf[code] = contracts[code];
  });
  instanceOf.provider = provider;
  return contracts;
};

module.exports = {
  initContracts,
  instanceOf,
};
