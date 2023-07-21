const { expect } = require('chai');
const supertest = require('supertest');
const initApp = require('../../mocks/server');
const { usage } = require('../responses');

describe('GET /usage', async () => {
  let server;
  before(() => {
    const app = initApp();
    server = supertest(app);
  });

  it('should get all usage for pools', async function () {
    const { body: response } = await server.get('/v2/usage').expect('Content-Type', /json/).expect(200);
    expect(response).to.be.deep.equal(usage);
  });

  it('should get all usage for one pool', async function () {
    const poolId = 1;
    const { body: response } = await server.get(`/v2/usage/${poolId}`).expect('Content-Type', /json/).expect(200);
    expect(response).to.be.deep.equal(usage[0]);
  });
});
