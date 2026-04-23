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
  providerUrl: {
    doc: 'Providers URL (alias used by RI signer)',
    env: 'PROVIDER_URL',
    default: '',
  },
});

config.validate({ allowed: 'strict' });

module.exports = config;
