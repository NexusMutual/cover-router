require('dotenv').config();
const convict = require('convict');

module.exports = convict({
  env: {
    doc: 'The application environment.',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV',
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT',
    arg: 'port',
  },
  host: {
    doc: 'The host to bind.',
    default: 'localhost',
    env: 'HOST',
    arg: 'host',
  },
  provider: {
    ws: {
      doc: 'Providers WS URL',
      default: '',
      env: 'PROVIDER_WS',
    },
    http: {
      doc: 'Providers HTTP URL',
      default: 'http://127.0.0.1:8545/',
      env: 'PROVIDER_HTTP',
    },
  },
});
