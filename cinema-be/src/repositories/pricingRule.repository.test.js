const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const pricingRuleRepository = require('./pricingRule.repository');
const PricingRule = require('../models/PricingRule');
const Branch = require('../models/Branch');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('pricingRule.repository', () => {
  it('findFiltered sorts by priority desc then id desc, and paginates', async () => {
    await PricingRule.create([
      { id: 1, name: 'A', price: 1, priority: 1 },
      { id: 2, name: 'B', price: 1, priority: 5 },
      { id: 3, name: 'C', price: 1, priority: 5 },
    ]);
    const result = await pricingRuleRepository.findFiltered({});
    expect(result.total).toBe(3);
    expect(result.data.map((r) => r.id)).toEqual([3, 2, 1]);
  });

  it('findFiltered applies the given filter', async () => {
    await PricingRule.create([
      { id: 1, name: 'A', price: 1, branch_id: 1 },
      { id: 2, name: 'B', price: 1, branch_id: 2 },
    ]);
    const result = await pricingRuleRepository.findFiltered({ branch_id: 1 });
    expect(result.total).toBe(1);
    expect(result.data[0].id).toBe(1);
  });

  it('findById returns the matching rule', async () => {
    await PricingRule.create({ id: 1, name: 'A', price: 1 });
    expect((await pricingRuleRepository.findById(1)).name).toBe('A');
  });

  it('findById returns null for an unknown id', async () => {
    expect(await pricingRuleRepository.findById(999)).toBeNull();
  });

  it('findOwnedCinemaIds returns branch ids owned by the account', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
      { id: 2, company_id: 1, owner_id: 99, name: 'B', code: 'B' },
    ]);
    expect(await pricingRuleRepository.findOwnedCinemaIds(42)).toEqual([1]);
  });

  it('create/updateFields/remove manage a rule document', async () => {
    const created = await pricingRuleRepository.create({ id: 1, name: 'A', price: 100000 });
    expect(created.id).toBe(1);

    const updated = await pricingRuleRepository.updateFields(1, { price: 90000, active: false });
    expect(updated.price).toBe(90000);
    expect(updated.active).toBe(false);

    await pricingRuleRepository.remove(1);
    expect(await PricingRule.countDocuments()).toBe(0);
  });
});
