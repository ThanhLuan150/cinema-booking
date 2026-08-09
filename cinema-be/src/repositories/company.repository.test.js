const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const companyRepository = require('./company.repository');
const Company = require('../models/Company');
const Branch = require('../models/Branch');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('company.repository', () => {
  it('findAll paginates companies', async () => {
    await Company.create([
      { id: 1, name: 'Acme', code: 'ACME' },
      { id: 2, name: 'Globex', code: 'GLOBEX' },
    ]);
    const result = await companyRepository.findAll({ skip: 0, limit: 20 });
    expect(result.total).toBe(2);
  });

  it('findById finds a company by numeric id', async () => {
    await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
    expect((await companyRepository.findById('1')).name).toBe('Acme');
  });

  it('findByCode is case-insensitive', async () => {
    await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
    expect(await companyRepository.findByCode('acme')).not.toBeNull();
  });

  it('create/updateFields/remove manage a company document', async () => {
    const created = await companyRepository.create({ id: 1, name: 'Acme', code: 'ACME' });
    expect(created.id).toBe(1);

    const updated = await companyRepository.updateFields(1, { name: 'Updated' });
    expect(updated.name).toBe('Updated');

    await companyRepository.remove(1);
    expect(await Company.countDocuments()).toBe(0);
  });

  describe('hasBranches', () => {
    it('is false with no branches', async () => {
      await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
      expect(await companyRepository.hasBranches(1)).toBe(false);
    });

    it('is true when a branch references the company', async () => {
      await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
      expect(await companyRepository.hasBranches(1)).toBe(true);
    });
  });
});
