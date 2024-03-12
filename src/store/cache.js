const fs = require('fs');
const path = require('path');
const { BigNumber } = require('ethers');

const stateFile = path.resolve(__dirname, '../../storage/state.json');

const parseCache = item => {
  if (item && item.type === 'BigNumber' && item.hex) {
    return BigNumber.from(item);
  }

  if (Array.isArray(item)) {
    return item.map(parseCache);
  }

  if (typeof item === 'object') {
    const entries = Object.entries(item);
    return entries.reduce((acc, [key, value]) => ({ ...acc, [key]: parseCache(value) }), {});
  }

  return item;
};

const load = defaultState => {
  if (!fs.existsSync(stateFile)) {
    return defaultState;
  }

  const contents = fs.readFileSync(stateFile, 'utf8');
  return parseCache(JSON.parse(contents));
};

const save = state => {
  const serialized = JSON.stringify(state, null, 2);
  fs.writeFileSync(stateFile, serialized);
};

const clear = () => {
  fs.unlinkSync(stateFile);
};

module.exports = {
  stateFile,
  parseCache,
  clear,
  load,
  save,
};
