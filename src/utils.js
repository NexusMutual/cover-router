const EventEmitter = require("events");

const NEW_BLOCK_POLL_INTERVAL = 15000;

function getPollingBlockEmitter(provider) {

  let lastBlockNumber = undefined;
  const emitter = EventEmitter();

  provider.on("block", (blockNumber) => {
    emitter.emit("block", blockNumber);
    lastBlockNumber = blockNumber;
  });

  setTimeout(async () => {
    const blockNumber = await provider.getBlockNumber();
    if (blockNumber.gt(lastBlockNumber)) {
      emitter.emit("block", blockNumber);
      lastBlockNumber = blockNumber;
    }
  }, NEW_BLOCK_POLL_INTERVAL);

  return emitter;
}

module.exports = {
  getPollingBlockEmitter
};