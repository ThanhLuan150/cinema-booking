const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const campaignController = require('./campaign.controller');
const Campaign = require('../models/Campaign');
const CampaignBanner = require('../models/CampaignBanner');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const ALL = { permissionScope: 'ALL', account: { accountId: 1 } };
const BRANCH = (accountId, scope = 'BRANCH') => ({ permissionScope: scope, account: { accountId } });

beforeAll(async () => {
  await connect();
  await Campaign.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function branch(id, ownerId) {
  return Branch.create({ id, company_id: 1, code: `B${id}`, name: `B${id}`, owner_id: ownerId });
}

const WINDOW = () => ({
  start_at: new Date(Date.now() - 3600_000).toISOString(),
  end_at: new Date(Date.now() + 3600_000).toISOString(),
});

describe('campaign.controller — create scope', () => {
  it('lets a SUPER_ADMIN create a Global Campaign (branch_id null) and writes an audit row', async () => {
    const res = mockRes();
    await campaignController.create({ ...ALL, body: { name: 'Global', ...WINDOW() } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.branch_id).toBeNull();
    expect(body.status).toBe('DRAFT');

    const audit = await AuditLog.findOne({ entity_type: 'CAMPAIGN', action: 'CAMPAIGN_CREATED' });
    expect(audit).not.toBeNull();
    expect(audit.entity_id).toBe(body.id);
  });

  it('forbids a BRANCH_ADMIN from creating a Global Campaign', async () => {
    const res = mockRes();
    await campaignController.create({ ...BRANCH(5), body: { name: 'Global', ...WINDOW() } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('forbids a BRANCH_ADMIN from creating a campaign on a branch they do not own', async () => {
    await branch(7, 999);
    const res = mockRes();
    await campaignController.create({ ...BRANCH(5), body: { name: 'X', branch_id: 7, ...WINDOW() } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('lets a BRANCH_ADMIN create a campaign on their own branch', async () => {
    await branch(7, 5);
    const res = mockRes();
    await campaignController.create({ ...BRANCH(5), body: { name: 'Mine', branch_id: 7, ...WINDOW() } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].branch_id).toBe(7);
  });

  it('rejects an invalid window', async () => {
    const res = mockRes();
    await campaignController.create(
      { ...ALL, body: { name: 'Bad', start_at: '2026-06-30', end_at: '2026-06-01' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_CAMPAIGN_WINDOW' }));
  });

  it('rejects a link to a movie that does not exist', async () => {
    const res = mockRes();
    await campaignController.create({ ...ALL, body: { name: 'X', movie_ids: [123], ...WINDOW() } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'LINK_NOT_FOUND' }));
  });
});

describe('campaign.controller — update / delete scope', () => {
  it('forbids a BRANCH_ADMIN from editing a Global Campaign but lets them read it', async () => {
    await Campaign.create({ id: 1, name: 'Global', status: 'ACTIVE', ...WINDOW() });

    const readRes = mockRes();
    await campaignController.getById({ ...BRANCH(5), params: { id: 1 } }, readRes);
    expect(readRes.json).toHaveBeenCalled();
    expect(readRes.status).not.toHaveBeenCalledWith(403);

    const editRes = mockRes();
    await campaignController.update({ ...BRANCH(5), params: { id: 1 }, body: { name: 'Hijack' } }, editRes);
    expect(editRes.status).toHaveBeenCalledWith(403);
    expect((await Campaign.findOne({ id: 1 })).name).toBe('Global');
  });

  it('records a status change as its own audit action', async () => {
    await Campaign.create({ id: 1, name: 'C', status: 'DRAFT', ...WINDOW() });
    const res = mockRes();
    await campaignController.update({ ...ALL, params: { id: 1 }, body: { status: 'ACTIVE' } }, res);
    expect(res.json).toHaveBeenCalled();
    const audit = await AuditLog.findOne({ action: 'CAMPAIGN_STATUS_CHANGED' });
    expect(audit.metadata).toMatchObject({ from: 'DRAFT', to: 'ACTIVE' });
  });

  it('deletes a campaign and its banners together', async () => {
    await Campaign.create({ id: 1, name: 'C', status: 'ACTIVE', ...WINDOW() });
    await CampaignBanner.create({ id: 1, campaign_id: 1, title: 'B', image_url: 'http://x/b.png' });
    const res = mockRes();
    await campaignController.remove({ ...ALL, params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Deleted' });
    expect(await CampaignBanner.countDocuments({ campaign_id: 1 })).toBe(0);
  });
});

describe('campaign.controller — list', () => {
  it('filters by derived state (EXPIRED) even though state is never stored', async () => {
    await Campaign.create({
      id: 1,
      name: 'Live',
      status: 'ACTIVE',
      start_at: new Date(Date.now() - 3600_000),
      end_at: new Date(Date.now() + 3600_000),
    });
    await Campaign.create({
      id: 2,
      name: 'Done',
      status: 'ACTIVE',
      start_at: new Date(Date.now() - 7200_000),
      end_at: new Date(Date.now() - 3600_000),
    });
    const res = mockRes();
    await campaignController.list({ ...ALL, query: { state: 'EXPIRED' } }, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.map((c) => c.id)).toEqual([2]);
    expect(body.data[0].display_state).toBe('EXPIRED');
  });

  it('scopes a BRANCH_ADMIN to their own branches plus Global', async () => {
    await branch(7, 5);
    await branch(9, 999);
    await Campaign.create({ id: 1, name: 'Global', status: 'ACTIVE', branch_id: null, ...WINDOW() });
    await Campaign.create({ id: 2, name: 'Mine', status: 'ACTIVE', branch_id: 7, ...WINDOW() });
    await Campaign.create({ id: 3, name: 'Theirs', status: 'ACTIVE', branch_id: 9, ...WINDOW() });
    const res = mockRes();
    await campaignController.list({ ...BRANCH(5), query: {} }, res);
    const ids = res.json.mock.calls[0][0].data.map((c) => c.id).sort();
    expect(ids).toEqual([1, 2]);
  });
});

describe('campaign.controller — publicFeed', () => {
  it('never returns an expired campaign', async () => {
    await Campaign.create({
      id: 1,
      name: 'Expired',
      status: 'ACTIVE',
      start_at: new Date(Date.now() - 7200_000),
      end_at: new Date(Date.now() - 3600_000),
    });
    const res = mockRes();
    await campaignController.publicFeed({ query: { branchId: '' } }, res);
    expect(res.json).toHaveBeenCalledWith({ data: [] });
  });
});
