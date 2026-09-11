const { withTimeout } = require('./withTimeout');

describe('withTimeout', () => {
  it('resolves with the promise value when it settles before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('rejects with the promise error when it rejects before the timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom');
  });

  it('rejects with a timeout error when the promise never settles in time', async () => {
    await expect(withTimeout(new Promise(() => {}), 10, 'too slow')).rejects.toThrow('too slow');
  });
});
