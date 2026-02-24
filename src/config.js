const convict = require('convict');

const config = convict({
  logLevel: {
    doc: 'The logging level to set',
    default: 'WARN',
    env: 'LOG_LEVEL',
  },
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
  customPriorityPoolsOrder: {
    doc: 'Custom Priority Pools Order for products',
    format: Object,
    default: {},
  },
  awsAccessKeyId: {
    doc: 'The AWS credentials key ID',
    default: '',
    env: 'AWS_ACCESS_KEY_ID',
  },
  awsSecretAccessKey: {
    doc: 'The AWS credentials secret access key',
    default: '',
    env: 'AWS_SECRET_ACCESS_KEY',
  },
  awsKmsKeyId: {
    doc: 'The UUID of the AWS KMS key or AWS KMS key alias',
    default: '',
    env: 'AWS_KMS_KEY_ID',
  },
  awsRegion: {
    doc: 'The AWS region where the KMS key is located',
    default: '',
    env: 'AWS_REGION',
  },
});

// Automatically detect and add PRIORITY_POOLS_ORDER environment variables
const envVars = process.env;
for (const [key, value] of Object.entries(envVars)) {
  if (key.startsWith('PRIORITY_POOLS_ORDER_')) {
    const productId = key.split('_').pop();
    const intArray = value.split(',').map((num, index) => {
      const parsed = parseInt(num.trim(), 10);
      if (isNaN(parsed)) {
        throw new Error(`Invalid integer in PRIORITY_POOLS_ORDER_${productId} at index ${index}: ${num}`);
      }
      return parsed;
    });
    config.set(`customPriorityPoolsOrder.${productId}`, intArray);
  }
}

config.validate({ allowed: 'strict' });

module.exports = config;
