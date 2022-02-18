require('dotenv').config();
const ethers = require('ethers');

const routes = require('./routes');
const { initContracts } = require('./initContracts');

async function startServer (app, port) {
  return new Promise(resolve => app.listen(port, resolve));
}

function getEnv (key, fallback = false) {
  const value = process.env[key] || fallback;

  if (!value) {
    throw new Error(`Missing env var: ${key}`);
  }

  return value;
}

async function init () {
  const PORT = getEnv('PORT');

  const provider = new ethers.providers.JsonRpcProvider(
    process.env.PROVIDER_URL,
  );
  // Get contracts instances
  console.log(`Getting contract instances...`);
  await initContracts(['CD', 'QD', 'CP'], provider);
  const app = routes();
  await startServer(app, PORT);
  console.log(`proof-api listening on port ${PORT}`);
}

init().catch(error => {
  console.error('Unhandled app error:', error);
  process.exit(1);
});
