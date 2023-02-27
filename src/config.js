require('dotenv').config();
const convict = require('convict');

module.exports = convict({
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT',
  },
  provider: {
    doc: 'Providers URL',
    env: 'PROVIDER_URL',
    default: 'ws://127.0.0.1:8545/',
  },
  contractsPath: {
    doc: 'URL of the contracts',
    env: 'CONTRACTS_ADDRESSES',
    default: '/tmp/contracts.js',
  },
  contractsUrl: {
    doc: 'URL of the contracts',
    default: 'https://api.nexusmutual.io/version-data/data.json',
    env: 'CONTRACTS_URL',
  },
});
