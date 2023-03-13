const { createStore } = require('redux');

const actions = require('./actions');
const reducer = require('./reducer');
const selectors = require('./selectors');

module.exports = {
  actions,
  createStore: () => createStore(reducer),
  selectors,
};
