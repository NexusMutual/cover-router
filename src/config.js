const convict = require('convict');

module.exports = convict({
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT',
  },
  concurrency: {
    doc: 'Number of concurrent promises',
    env: 'CONCURRENCY_NUMBER',
    default: 5,
  },
  provider: {
    doc: 'Providers URL',
    env: 'PROVIDER_URL',
    default: '',
  },
  contractAddresses: {
    doc: 'Path to contract addresses json file',
    env: 'CONTRACTS_ADDRESSES',
    default: '',
  },
  contractsUrl: {
    doc: 'URL of the contracts',
    default: 'https://api.nexusmutual.io/version-data/data.json',
    env: 'CONTRACTS_URL',
  },
});
