const { TRANCHE_DURATION, BUCKET_DURATION } = require('./constants');

const bnMax = (a, b) => (a.gt(b) ? a : b);

const bnMin = (a, b) => (a.lt(b) ? a : b);

const divCeil = (a, b) => a.div(b).add(a.mod(b).gt(0) ? 1 : 0);

const calculateTrancheId = time => Math.floor(time / TRANCHE_DURATION);
const calculateBucketId = time => Math.floor(time / BUCKET_DURATION);

const asyncRoute = fn => (req, res, next) => {
  fn(req, res, next).catch(err => {
    console.error(err);
    res.status(500).send({ error: 'Internal Server Error', response: null });
  });
};

const promiseAllInBatches = async (task, items, concurrency) => {
  const itemsClone = [...items];
  const results = [];
  while (itemsClone.length) {
    const itemsForBatch = itemsClone.splice(0, concurrency);
    const newItems = await Promise.all(itemsForBatch.map(item => task(item)));
    results.push(...newItems);
  }
  return results;
};

module.exports = {
  bnMax,
  bnMin,
  divCeil,
  calculateTrancheId,
  calculateBucketId,
  asyncRoute,
  promiseAllInBatches,
};
