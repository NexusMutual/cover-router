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
    process.env.PRIORITY_POOLS_ORDER_186 = '18,22,1';
    process.env.PRIORITY_POOLS_ORDER_195 = '1,23,22,2,5';
    process.env.PRIORITY_POOLS_ORDER_196 = '1,23,22,2,5';

    // Import modules after setting environment variables
    const { initialState } = require('../../src/store/reducer');

    expect(initialState.productPriorityPoolsFixedPrice['186']).to.deep.equal([18, 22, 1]);
    expect(initialState.productPriorityPoolsFixedPrice['195']).to.deep.equal([1, 23, 22, 2, 5]);
    expect(initialState.productPriorityPoolsFixedPrice['196']).to.deep.equal([1, 23, 22, 2, 5]);
  });

  it('should throw an error for invalid custom priority pools order values', () => {
    process.env.PRIORITY_POOLS_ORDER_186 = '18,22,invalid,1';

    expect(() => {
      require('../../src/config');
    }).to.throw('Invalid integer in PRIORITY_POOLS_ORDER_186 at index 2: invalid');
  });
});
