const { notFound, errorHandler } = require('./errorHandler');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('notFound', () => {
  it('responds with 404 and a message describing the route', () => {
    const req = { method: 'GET', originalUrl: '/api/unknown' };
    const res = mockRes();

    notFound(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Route not found: GET /api/unknown' });
  });
});

describe('errorHandler', () => {
  let errorSpy;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('uses the error status and message when provided', () => {
    const err = Object.assign(new Error('Not allowed'), { status: 403 });
    const res = mockRes();

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not allowed' });
  });

  it('defaults to a 500 status and generic message', () => {
    const err = new Error();
    const res = mockRes();

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
  });

  it('logs the error', () => {
    const err = new Error('boom');
    errorHandler(err, {}, mockRes(), jest.fn());
    expect(errorSpy).toHaveBeenCalledWith(err);
  });

  it('passes a client-facing domain error through with its code, and does not log it as a fault', () => {
    const InsufficientStockError = require('../utils/InsufficientStockError');
    const err = new InsufficientStockError([{ combo_id: 1, inventory_id: 9, item: 'Popcorn', requested: 5, available: 2 }]);
    const res = mockRes();

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Insufficient stock for Popcorn: requested 5, available 2',
      code: 'INSUFFICIENT_STOCK',
      shortages: err.shortages,
      item: 'Popcorn',
      requested: 5,
      available: 2,
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('never leaks the code of a 5xx error, and ignores the numeric code a driver error carries', () => {
    const res = mockRes();
    errorHandler(Object.assign(new Error('E11000 dup'), { code: 11000 }), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'E11000 dup' });

    const res2 = mockRes();
    errorHandler(Object.assign(new Error('down'), { status: 503, code: 'UPSTREAM' }), {}, res2, jest.fn());
    expect(res2.json).toHaveBeenCalledWith({ message: 'down' });
  });
});
