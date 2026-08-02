const asyncHandler = require('./asyncHandler');

describe('asyncHandler', () => {
  it('calls the wrapped function with req, res, next', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const req = {};
    const res = {};
    const next = jest.fn();

    await asyncHandler(fn)(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a rejected promise to next', async () => {
    const error = new Error('boom');
    const fn = jest.fn().mockRejectedValue(error);
    const next = jest.fn();

    await asyncHandler(fn)({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('forwards an error thrown inside an async handler to next', async () => {
    const error = new Error('async boom');
    const fn = jest.fn(async () => {
      throw error;
    });
    const next = jest.fn();

    await asyncHandler(fn)({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
