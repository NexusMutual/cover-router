const { expect } = require('chai');
const { getDefaultProvider } = require('ethers');

const eventsApiConstructor = require('../../src/lib/eventsApi');

const stakingPoolEvents = ['StakeBurned', 'DepositExtended', 'StakeDeposited', 'PoolFeeChanged', 'Deallocated'];
const coverEvents = ['ProductSet', 'CoverEdited'];
const stakingProductsEvents = ['ProductUpdated'];
const stakingPoolFactoryEvents = ['StakingPoolCreated'];

const contractFactory = require('../../src/lib/contracts');
const { addresses } = require('@nexusmutual/deployments');

function contractFactoryMock(addresses, provider) {
  const factory = contractFactory(addresses, provider);

  const mockedFactory = (name, id = 0, forceNew = false) => {
    if (name !== 'StakingPoolFactory') {
      return factory(name, id, forceNew);
    }

    const stakingPoolFactory = factory('StakingPoolFactory');
    const entries = Object.entries(stakingPoolFactory).map(([key, value]) => {
      return [key, key === 'stakingPoolCount' ? async () => 1 : value];
    });

    const stakingPoolFactoryMock = Object.fromEntries(entries);
    Object.setPrototypeOf(stakingPoolFactoryMock, Object.getPrototypeOf(stakingPoolFactory));

    return stakingPoolFactoryMock;
  };

  return mockedFactory;
}

const settleEvents = () => new Promise(resolve => setTimeout(resolve, 0));

describe('Catching events', () => {
  let eventsApi;
  let contracts;

  beforeEach(async function () {
    this.timeout(0);
    const provider = getDefaultProvider();
    contracts = contractFactoryMock(addresses, provider);
    eventsApi = await eventsApiConstructor(provider, contracts);
  });

  it('should catch all events on staking pool', async function () {
    const stakingPool = contracts('StakingPool', 1);
    let eventCounter = 0;
    let poolChangeCounter = 0;
    for (const eventName of stakingPoolEvents) {
      stakingPool.on(eventName, () => {
        eventCounter += 1;
        console.log(`Event: ${eventName} triggered`);
      });
    }
    eventsApi.on('pool:change', () => {
      poolChangeCounter += 1;
    });
    for (const eventName of stakingPoolEvents) {
      stakingPool.emit(eventName);
    }

    // pushing expect to end of the event queue
    await settleEvents();
    expect(eventCounter).to.be.equal(stakingPoolEvents.length);
    expect(poolChangeCounter).to.be.equal(stakingPoolEvents.length);
  });

  it('should catch all events on cover', async function () {
    const cover = contracts('Cover');
    let eventCounter = 0;
    let productChangeCounter = 0;
    for (const eventName of coverEvents) {
      cover.on(eventName, () => {
        eventCounter += 1;
        console.log(`Event: ${eventName} triggered`);
      });
    }
    eventsApi.on('product:change', () => {
      productChangeCounter += 1;
    });
    for (const eventName of coverEvents) {
      cover.emit(eventName);
    }

    // pushing expect to end of the event queue
    await settleEvents();
    expect(eventCounter).to.be.equal(coverEvents.length);
    expect(productChangeCounter).to.be.equal(coverEvents.length);
  });

  it('should catch all events on stakingProducts', async function () {
    const stakingProducts = contracts('StakingProducts');
    let eventCounter = 0;
    let productChangeCounter = 0;
    for (const eventName of stakingProductsEvents) {
      stakingProducts.on(eventName, () => {
        eventCounter += 1;
      });
    }
    eventsApi.on('product:change', () => {
      productChangeCounter += 1;
    });
    for (const eventName of stakingProductsEvents) {
      stakingProducts.emit(eventName);
    }

    // pushing expect to end of the event queue
    await settleEvents();
    expect(eventCounter).to.be.equal(stakingProductsEvents.length);
    expect(productChangeCounter).to.be.equal(stakingProductsEvents.length);
  });

  it('should catch all events on stakingPoolFactory', async function () {
    const stakingPoolFactory = contracts('StakingPoolFactory');
    let eventCounter = 0;
    let poolChangeCounter = 0;
    for (const eventName of stakingPoolFactoryEvents) {
      stakingPoolFactory.on(eventName, () => {
        eventCounter += 1;
      });
    }
    eventsApi.on('pool:change', () => {
      poolChangeCounter += 1;
    });
    for (const eventName of stakingPoolFactoryEvents) {
      stakingPoolFactory.emit(eventName);
    }

    // pushing expect to end of the event queue
    await settleEvents();
    expect(eventCounter).to.be.equal(stakingPoolFactoryEvents.length);
    expect(poolChangeCounter).to.be.equal(stakingPoolFactoryEvents.length);
  });
});
