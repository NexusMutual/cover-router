require('dotenv').config();
const convict = require('convict');

module.exports = convict({
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT',
    arg: 'port',
  },
  provider: {
    ws: {
      doc: 'Providers WS URL',
      env: 'PROVIDER_WS',
    },
    http: {
      doc: 'Providers HTTP URL',
      env: 'PROVIDER_HTTP',
    },
  },
  contractsUrl: {
    doc: 'URL of the contracts',
    default: 'https://api.nexusmutual.io/version-data/data.json',
    env: 'CONTRACTS_URL',
  },
});
