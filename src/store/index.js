const { createStore } = require('redux');

const { load, save } = require('./cache');
const actions = require('./actions');
const { reducer, initialState } = require('./reducer');
const selectors = require('./selectors');

module.exports = {
  actions,
  createStore: initialState => createStore(reducer, initialState),
  initialState,
  selectors,
  load,
  save,
};
