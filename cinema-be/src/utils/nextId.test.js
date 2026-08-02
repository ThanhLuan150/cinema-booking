const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const nextId = require('./nextId');
const Counter = require('../models/Counter');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('nextId', () => {
  it('starts a new counter at 1', async () => {
    const id = await nextId('movie');
    expect(id).toBe(1);
  });

  it('increments the counter on each call', async () => {
    const first = await nextId('movie');
    const second = await nextId('movie');
    const third = await nextId('movie');
    expect([first, second, third]).toEqual([1, 2, 3]);
  });

  it('keeps separate counters per name', async () => {
    const movieId = await nextId('movie');
    const cinemaId = await nextId('cinema');
    expect(movieId).toBe(1);
    expect(cinemaId).toBe(1);
  });

  it('persists the sequence in the Counter collection', async () => {
    await nextId('ticket');
    await nextId('ticket');
    const counter = await Counter.findOne({ name: 'ticket' });
    expect(counter.seq).toBe(2);
  });
});
