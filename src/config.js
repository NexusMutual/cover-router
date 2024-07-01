require('dotenv').config();

const convict = require('convict');

const requiredEnvVars = [
  'PROVIDER_URL',
  'PRIORITY_POOLS_ORDER_186',
  'PRIORITY_POOLS_ORDER_195',
  'PRIORITY_POOLS_ORDER_196',
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Missing ${envVar} env`);
  }
});

// custom array format
convict.addFormat({
  name: 'array-int',
  validate: function (val) {
    if (!Array.isArray(val)) {
      throw new Error('must be of type Array');
    }
  },
  coerce: function (val) {
    const arr = val.replace(/\s+/g, '').split(',');
    return arr.map(numString => parseInt(numString));
  },
});

const config = convict({
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
  customPoolPriorityOrder186: {
    doc: 'Custom Pool Priority Order for productId 186 - DeltaPrime (UnoRe)',
    format: 'array-int',
    env: 'PRIORITY_POOLS_ORDER_186',
    default: [18, 22, 1],
  },
  customPoolPriorityOrder195: {
    doc: 'Custom Pool Priority Order for productId 195 - Dialectic Moonphase',
    format: 'array-int',
    env: 'PRIORITY_POOLS_ORDER_195',
    default: [1, 23, 22, 2, 5],
  },
  customPoolPriorityOrder196: {
    doc: 'Custom Pool Priority Order for productId 196 - Dialectic Chronograph',
    format: 'array-int',
    env: 'PRIORITY_POOLS_ORDER_196',
    default: [1, 23, 22, 2, 5],
  },
});

config.validate({ allowed: 'strict' });

module.exports = config;
