const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const nextId = require('../utils/nextId');
const { emitPublic } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');
const { normalizeBenefits, validateBenefitsInput } = require('../utils/membershipBenefits');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,29}$/;
const MIN_PRICE = 1000; // MoMo refuses smaller charges
const EDITABLE = ['name', 'description', 'price', 'duration_days', 'active', 'sort_order', 'benefits'];

function present(plan) {
  const json = plan.toJSON();
  return { ...json, benefits: normalizeBenefits(json.benefits) };
}

// The catalogue is shown on the customer membership page, so a change goes out publicly (without
// anything not already in the public list).
function broadcast(plan, action) {
  emitPublic(REALTIME_EVENT.MEMBERSHIP_UPDATED, { action, scope: 'SUBSCRIPTION_PLAN', id: plan.id, active: plan.active });
}

// Sends the 400 and returns null, so readFields can `return badRequest(...)`.
function badRequest(res, message, extra = {}) {
  res.status(400).json({ message, code: 'VALIDATION_ERROR', ...extra });
  return null;
}

// Validates the editable fields present in `body`. Returns { updates } or sends a 400 (returns null).
function readFields(res, body, { creating }) {
  const unknown = Object.keys(body).filter((key) => !EDITABLE.includes(key) && !(creating && key === 'code'));
  if (unknown.length > 0) return badRequest(res, `Unknown field(s): ${unknown.join(', ')}`, { fields: unknown });

  const updates = {};
  if (creating) {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!CODE_RE.test(code)) return badRequest(res, 'code must be 2-30 letters, digits, "_" or "-"');
    updates.code = code;
  }
  if (body.name !== undefined || creating) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 120) return badRequest(res, 'name is required (at most 120 characters)');
    updates.name = name;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.length > 500) {
      return badRequest(res, 'description must be text of at most 500 characters');
    }
    updates.description = body.description;
  }
  if (body.price !== undefined || creating) {
    const price = Number(body.price);
    if (!Number.isInteger(price) || price < MIN_PRICE) return badRequest(res, `price must be a whole amount of at least ${MIN_PRICE}`);
    updates.price = price;
  }
  if (body.duration_days !== undefined || creating) {
    const days = Number(body.duration_days);
    if (!Number.isInteger(days) || days < 1 || days > 366) return badRequest(res, 'duration_days must be a whole number from 1 to 366');
    updates.duration_days = days;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') return badRequest(res, 'active must be true or false');
    updates.active = body.active;
  }
  if (body.sort_order !== undefined) {
    const order = Number(body.sort_order);
    if (!Number.isInteger(order)) return badRequest(res, 'sort_order must be a whole number');
    updates.sort_order = order;
  }
  const benefitsInput = validateBenefitsInput(body.benefits);
  if (benefitsInput.errors) {
    res.status(400).json({ message: benefitsInput.errors.map((e) => e.message).join('; '), code: 'INVALID_BENEFITS', errors: benefitsInput.errors });
    return null;
  }
  if (body.benefits !== undefined) updates.benefits = benefitsInput.benefits;
  return { updates };
}

// GET /api/subscription-plans -> the plans on sale now (customer catalogue).
async function listActive(req, res) {
  const plans = await SubscriptionPlan.find({ active: true }).sort({ sort_order: 1, price: 1, id: 1 });
  res.json(plans.map(present));
}

// GET /api/subscription-plans/all -> every plan, retired ones included (Super Admin).
async function listAll(req, res) {
  const plans = await SubscriptionPlan.find().sort({ sort_order: 1, price: 1, id: 1 });
  res.json(plans.map(present));
}

// POST /api/subscription-plans { code, name, description, price, duration_days, benefits, active, sort_order }
async function create(req, res) {
  const fields = readFields(res, req.body || {}, { creating: true });
  if (!fields) return;
  if (await SubscriptionPlan.exists({ code: fields.updates.code })) {
    return res.status(409).json({ message: 'A plan with this code already exists', code: 'SUBSCRIPTION_PLAN_CODE_EXISTS' });
  }
  let plan;
  try {
    plan = await SubscriptionPlan.create({
      id: await nextId('subscriptionPlan'),
      ...fields.updates,
      created_by: req.account.accountId,
      updated_by: req.account.accountId,
    });
  } catch (err) {
    // Only the code is ours to report; any other duplicate key is a real error.
    if (err.code === 11000 && err.keyPattern && err.keyPattern.code) {
      return res.status(409).json({ message: 'A plan with this code already exists', code: 'SUBSCRIPTION_PLAN_CODE_EXISTS' });
    }
    throw err;
  }
  await recordAudit({
    req,
    action: ACTION.SUBSCRIPTION_PLAN_CREATED,
    entityType: ENTITY_TYPE.SUBSCRIPTION_PLAN,
    entityId: plan.id,
    metadata: { code: plan.code, price: plan.price, duration_days: plan.duration_days },
  });
  broadcast(plan, REALTIME_ACTION.CREATED);
  res.status(201).json(present(plan));
}

// PUT /api/subscription-plans/:id — the code is fixed. A change only affects purchases made after it:
// every subscription already sold keeps the plan exactly as it was bought.
async function update(req, res) {
  const plan = await SubscriptionPlan.findOne({ id: Number(req.params.id) });
  if (!plan) return res.status(404).json({ message: 'Subscription plan not found', code: 'SUBSCRIPTION_PLAN_NOT_FOUND' });
  const fields = readFields(res, req.body || {}, { creating: false });
  if (!fields) return;

  const set = { updated_by: req.account.accountId };
  for (const [key, value] of Object.entries(fields.updates)) {
    if (key === 'benefits') {
      for (const [field, benefit] of Object.entries(value)) set[`benefits.${field}`] = benefit;
    } else {
      set[key] = value;
    }
  }
  const updated = await SubscriptionPlan.findOneAndUpdate({ id: plan.id }, { $set: set }, { new: true, runValidators: true });
  await recordAudit({
    req,
    action: ACTION.SUBSCRIPTION_PLAN_UPDATED,
    entityType: ENTITY_TYPE.SUBSCRIPTION_PLAN,
    entityId: updated.id,
    metadata: { code: updated.code, changes: fields.updates },
  });
  broadcast(updated, REALTIME_ACTION.UPDATED);
  res.json(present(updated));
}

// DELETE /api/subscription-plans/:id — only a plan nobody ever bought; a sold one is retired instead
// (active: false), so its subscriptions keep pointing at a real plan.
async function remove(req, res) {
  const plan = await SubscriptionPlan.findOne({ id: Number(req.params.id) });
  if (!plan) return res.status(404).json({ message: 'Subscription plan not found', code: 'SUBSCRIPTION_PLAN_NOT_FOUND' });
  if (await Subscription.exists({ plan_id: plan.id })) {
    return res.status(409).json({
      message: 'This plan has been sold; deactivate it instead of deleting it',
      code: 'SUBSCRIPTION_PLAN_IN_USE',
    });
  }
  await SubscriptionPlan.deleteOne({ id: plan.id });
  await recordAudit({
    req,
    action: ACTION.SUBSCRIPTION_PLAN_DELETED,
    entityType: ENTITY_TYPE.SUBSCRIPTION_PLAN,
    entityId: plan.id,
    metadata: { code: plan.code },
  });
  broadcast(plan, REALTIME_ACTION.DELETED);
  res.json({ message: 'Deleted' });
}

module.exports = { listActive, listAll, create, update, remove };
