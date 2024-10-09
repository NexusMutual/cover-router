const { expect } = require('chai');

describe('productPriorityPoolsFixedPrice state', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore the original environment variables
    process.env = originalEnv;
    // Clear the require cache to ensure fresh imports in each test
    delete require.cache[require.resolve('../../src/config')];
    delete require.cache[require.resolve('../../src/store/reducer')];
  });

  it('should populate initialState.productPriorityPoolsFixedPrice with valid arrays of integers', () => {
    // NOTE: the env vars are set in the mocks/store.js file

    // Import modules after environment variables are set
    const { initialState } = require('../../src/store/reducer');

    // Updated expectations for productPriorityPoolsFixedPrice
    expect(initialState.productPriorityPoolsFixedPrice['186']).to.deep.equal([18, 22, 1]);
    expect(initialState.productPriorityPoolsFixedPrice['195']).to.deep.equal([1, 23, 22, 2, 5]);
    expect(initialState.productPriorityPoolsFixedPrice['196']).to.deep.equal([1, 23, 22, 2, 5]);
    expect(initialState.productPriorityPoolsFixedPrice['227']).to.deep.equal([8, 23, 22, 2, 1, 5]);
    expect(initialState.productPriorityPoolsFixedPrice['233']).to.deep.equal([22, 2, 1, 23]);
  });

  it('should throw an error for invalid custom priority pools order values', () => {
    process.env.PRIORITY_POOLS_ORDER_186 = '18,22,invalid,1';

    expect(() => {
      require('../../src/config');
    }).to.throw('Invalid integer in PRIORITY_POOLS_ORDER_186 at index 2: invalid');
  });
});
