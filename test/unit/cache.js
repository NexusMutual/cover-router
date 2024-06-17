const fs = require('fs');

const { expect } = require('chai');
const { BigNumber } = require('ethers');

const { stateFile, parseCache, clear, load, save } = require('../../src/store/cache');

describe('cache', function () {
  beforeEach(function () {
    fs.existsSync(stateFile) && fs.unlinkSync(stateFile);
  });

  it('clear should remove the file', function () {
    fs.writeFileSync(stateFile, 'test');
    clear();
    expect(fs.existsSync(stateFile)).to.equal(false);
  });

  it('load should return default state if file does not exist', function () {
    const defaultState = { test: 'test' };
    const state = load(defaultState);
    expect(state).to.deep.equal(defaultState);
  });

  it('load should return the state from the file', function () {
    const defaultState = { test: 'test' };
    const state = { test: 'test2' };
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    const loadedState = load(defaultState);
    expect(loadedState).to.deep.equal({ ...state, assets: {}, productPriorityPoolsFixedPrice: {} });
  });

  it('save should write the state to the file', function () {
    const state = { test: 'test' };
    save(state);
    const contents = fs.readFileSync(stateFile, 'utf8');
    expect(JSON.parse(contents)).to.deep.equal(state);
  });

  it('parseCache should parse BigNumber', function () {
    const state = { test: BigNumber.from(42) };
    const parsed = parseCache(JSON.parse(JSON.stringify(state)));
    expect(parsed).to.deep.equal(state);
  });

  it('parseCache should parse array containing BigNumber', function () {
    const state = { test: [BigNumber.from(42), 43, '44'] };
    const parsed = parseCache(JSON.parse(JSON.stringify(state)));
    expect(parsed).to.deep.equal(state);
  });

  it('parseCache should parse normal objects', function () {
    const state = { test: { a: BigNumber.from(42), b: 43 } };
    const parsed = parseCache(JSON.parse(JSON.stringify(state)));
    expect(parsed).to.deep.equal(state);
  });
});
