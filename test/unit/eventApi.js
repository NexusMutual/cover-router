const { addresses } = require('@nexusmutual/deployments');
const { expect } = require('chai');
const { ethers, getDefaultProvider } = require('ethers');

const contractFactory = require('../../src/lib/contracts');
const eventsApiConstructor = require('../../src/lib/eventsApi');
const riContractFactory = require('../../src/lib/riContracts');

const stakingPoolEvents = ['StakeBurned', 'DepositExtended', 'StakeDeposited', 'PoolFeeChanged', 'Deallocated'];
const coverEvents = ['CoverBought'];
const coverProductsEvents = ['ProductSet'];
const stakingProductsEvents = ['ProductUpdated'];
const stakingPoolFactoryEvents = ['StakingPoolCreated'];

function contractFactoryMock(addresses, provider) {
  const factory = contractFactory(addresses, provider);
  let coverInstance;

  const mockedFactory = (name, id = 0, forceNew = false) => {
    if (name === 'Cover') {
      if (!coverInstance || forceNew) {
        const cover = factory('Cover', id, forceNew);
        // Add CoverRiAllocated event that is not yet in the deployed ABI
        const fragment = ethers.utils.EventFragment.from(
          'CoverRiAllocated(uint256 coverId, uint256 premium, address paymentAsset, bytes data, uint8 dataFormat)',
        );
        cover.interface.events[fragment.format()] = fragment;
        coverInstance = cover;
      }
      return coverInstance;
    }

    if (name !== 'StakingPoolFactory') {
      console.log({ name, id, forceNew });
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
  let riContracts;

  beforeEach(async function () {
    this.timeout(0);
    const provider = getDefaultProvider();
    contracts = contractFactoryMock(addresses, provider);
    riContracts = riContractFactory(provider);
    eventsApi = await eventsApiConstructor(provider, contracts, riContracts);
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

  it('should catch all events on coverProducts', async function () {
    const cover = contracts('CoverProducts');
    let eventCounter = 0;
    let productChangeCounter = 0;
    for (const eventName of coverProductsEvents) {
      cover.on(eventName, () => {
        eventCounter += 1;
        console.log(`Event: ${eventName} triggered`);
      });
    }
    eventsApi.on('product:change', () => {
      productChangeCounter += 1;
    });
    for (const eventName of coverProductsEvents) {
      cover.emit(eventName);
    }

    // pushing expect to end of the event queue
    await settleEvents();
    expect(eventCounter).to.be.equal(coverProductsEvents.length);
    expect(productChangeCounter).to.be.equal(coverProductsEvents.length);
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

  it('should catch SetOperatorNetworkShares and SetOperatorNetworkLimit on delegators', async function () {
    const subnetwork = '0xf99aa6479eb153dca93fd243a06cacd11f3268f9000000000000000000000001';
    const operator = '0xF99aA6479Eb153dcA93fd243A06caCD11f3268f9';
    const sharesVaultIds = [];
    const limitVaultIds = [];

    eventsApi.on('ri:setOperatorNetworkShares', vaultId => {
      sharesVaultIds.push(vaultId);
    });
    eventsApi.on('ri:setOperatorNetworkLimit', vaultId => {
      limitVaultIds.push(vaultId);
    });

    // Emit events with realistic args on each delegator contract
    for (const contractName of Object.keys(riContracts)) {
      if (contractName.startsWith('delegator_')) {
        riContracts[contractName].emit('SetOperatorNetworkShares', subnetwork, operator, 1000);
        riContracts[contractName].emit('SetOperatorNetworkLimit', subnetwork, operator, 5000);
      }
    }

    await settleEvents();

    const delegatorKeys = Object.keys(riContracts).filter(k => k.startsWith('delegator_'));
    const expectedVaultIds = delegatorKeys.map(k => k.split('_')[1]);

    expect(sharesVaultIds).to.have.members(expectedVaultIds);
    expect(limitVaultIds).to.have.members(expectedVaultIds);
  });
});
