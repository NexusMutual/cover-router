const { createStore } = require('redux');

const actions = require('./actions');
const { load, save } = require('./cache');
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
