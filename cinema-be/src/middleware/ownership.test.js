jest.mock('../repositories/cinema.repository');

const cinemaRepository = require('../repositories/cinema.repository');
const { requireCinemaOwnership } = require('./ownership');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireCinemaOwnership', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('responds with 404 when resolveCinemaId returns null', async () => {
    const middleware = requireCinemaOwnership(async () => null);
    const req = { account: { accountId: 1, role: 1 } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets admins (role 0) through without checking cinema ownership', async () => {
    const middleware = requireCinemaOwnership(async () => 5);
    const req = { account: { accountId: 1, role: 0 } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(cinemaRepository.findById).not.toHaveBeenCalled();
    expect(req.cinemaId).toBe(5);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('responds with 404 when the cinema does not exist', async () => {
    cinemaRepository.findById.mockResolvedValue(null);
    const middleware = requireCinemaOwnership(async () => 5);
    const req = { account: { accountId: 1, role: 2 } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds with 403 when the account does not own the cinema', async () => {
    cinemaRepository.findById.mockResolvedValue({ id: 5, owner_id: 99 });
    const middleware = requireCinemaOwnership(async () => 5);
    const req = { account: { accountId: 1, role: 2 } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches cinemaId and cinema then calls next for the owning account', async () => {
    const cinema = { id: 5, owner_id: 1 };
    cinemaRepository.findById.mockResolvedValue(cinema);
    const middleware = requireCinemaOwnership(async () => 5);
    const req = { account: { accountId: 1, role: 2 } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(req.cinemaId).toBe(5);
    expect(req.cinema).toBe(cinema);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('forwards a thrown error from resolveCinemaId to next', async () => {
    const error = new Error('resolve failed');
    const middleware = requireCinemaOwnership(async () => {
      throw error;
    });
    const req = { account: { accountId: 1, role: 2 } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
