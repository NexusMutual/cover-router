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
  pollingInterval: {
    doc: 'Polling interval for eth_getLogs in ms',
    format: 'int',
    env: 'POLLING_INTERVAL',
    default: 30_000,
  },
});
