const jwt = require('jsonwebtoken');
const { requireAuth, optionalAuth } = require('./auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth', () => {
  it('rejects requests with no Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Missing Authorization token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a header that is not a Bearer token', () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid/expired token', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the decoded payload to req.account and calls next for a valid token', () => {
    const token = jwt.sign({ accountId: 1, email: 'a@b.com', role: 1 }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.account).toMatchObject({ accountId: 1, email: 'a@b.com', role: 1 });
  });
});

describe('optionalAuth', () => {
  it('calls next without setting req.account when there is no token', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    optionalAuth(req, res, next);

    expect(req.account).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next without setting req.account for an invalid token', () => {
    const req = { headers: { authorization: 'Bearer garbage' } };
    const res = mockRes();
    const next = jest.fn();

    optionalAuth(req, res, next);

    expect(req.account).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attaches req.account and calls next for a valid token', () => {
    const token = jwt.sign({ accountId: 2, role: 0 }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    optionalAuth(req, res, next);

    expect(req.account).toMatchObject({ accountId: 2, role: 0 });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
