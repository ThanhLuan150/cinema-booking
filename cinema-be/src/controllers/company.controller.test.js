const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const companyController = require('./company.controller');
const Company = require('../models/Company');
const Branch = require('../models/Branch');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('company.controller list/getById', () => {
  it('list paginates companies', async () => {
    await Company.create([
      { id: 1, name: 'Acme', code: 'ACME' },
      { id: 2, name: 'Globex', code: 'GLOBEX' },
    ]);
    const res = mockRes();
    await companyController.list({ query: {} }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('getById returns 404 for an unknown company', async () => {
    const res = mockRes();
    await companyController.getById({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getById returns the matching company', async () => {
    await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
    const res = mockRes();
    await companyController.getById({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'Acme' }));
  });
});

describe('company.controller create', () => {
  it('rejects a missing name or code', async () => {
    const res = mockRes();
    await companyController.create({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a duplicate code (case-insensitive)', async () => {
    await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
    const res = mockRes();
    await companyController.create({ body: { name: 'Acme Two', code: 'acme' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'COMPANY_CODE_EXISTS' }));
  });

  it('creates an active company with an uppercased code', async () => {
    const res = mockRes();
    await companyController.create({ body: { name: 'Acme', code: 'acme', address: 'HN' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Company.findOne({ name: 'Acme' });
    expect(created.code).toBe('ACME');
    expect(created.status).toBe('ACTIVE');
  });
});

describe('company.controller update', () => {
  it('returns 404 for an unknown company', async () => {
    const res = mockRes();
    await companyController.update({ params: { id: 999 }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('applies only whitelisted fields, including status', async () => {
    await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
    const res = mockRes();
    await companyController.update({ params: { id: 1 }, body: { name: 'Acme Inc', status: 'INACTIVE', code: 'HACKED' } }, res);
    const updated = await Company.findOne({ id: 1 });
    expect(updated.name).toBe('Acme Inc');
    expect(updated.status).toBe('INACTIVE');
    expect(updated.code).toBe('ACME');
  });
});

describe('company.controller remove', () => {
  it('returns 404 for an unknown company', async () => {
    const res = mockRes();
    await companyController.remove({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes a company with no branches', async () => {
    await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
    const res = mockRes();
    await companyController.remove({ params: { id: 1 } }, res);
    expect(await Company.countDocuments()).toBe(0);
  });

  it('refuses to delete a company that still has branches', async () => {
    await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
    const res = mockRes();
    await companyController.remove({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'COMPANY_HAS_BRANCHES' }));
    expect(await Company.countDocuments()).toBe(1);
  });
});
