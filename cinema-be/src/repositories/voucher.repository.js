const Voucher = require('../models/Voucher');
const VoucherUsage = require('../models/VoucherUsage');
const Branch = require('../models/Branch');
const nextId = require('../utils/nextId');

async function findOwnedCinemaIds(accountId) {
  const ownedBranches = await Branch.find({ owner_id: accountId });
  return ownedBranches.map((c) => c.id);
}

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Voucher.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Voucher.countDocuments(filter),
  ]);
  return { data, total };
}

async function findByCode(code) {
  return Voucher.findOne({ code: String(code).toUpperCase(), active: true });
}

async function findById(id) {
  return Voucher.findOne({ id: Number(id) });
}

async function findCinemaById(branchId) {
  return Branch.findOne({ id: branchId });
}

async function create(data) {
  return Voucher.create(data);
}

async function updateFields(id, updates) {
  return Voucher.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  await VoucherUsage.deleteMany({ voucher_id: Number(id) });
  return Voucher.deleteOne({ id: Number(id) });
}

async function recordUsage({ voucherId, accountId, bookingId = null, discountAmount = 0 }) {
  const voucher = await Voucher.findOneAndUpdate(
    {
      id: Number(voucherId),
      $or: [{ max_uses: null }, { $expr: { $lt: ['$used_count', '$max_uses'] } }],
    },
    { $inc: { used_count: 1 } },
    { new: true },
  );
  if (!voucher) return null;

  await VoucherUsage.create({
    id: await nextId('voucherUsage'),
    voucher_id: voucher.id,
    account_id: Number(accountId),
    booking_id: bookingId !== null && bookingId !== undefined ? Number(bookingId) : null,
    discount_amount: Number(discountAmount) || 0,
  });
  return voucher;
}

async function findUsageHistory(voucherId, { skip = 0, limit = 20 } = {}) {
  const filter = { voucher_id: Number(voucherId) };
  const [data, total] = await Promise.all([
    VoucherUsage.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    VoucherUsage.countDocuments(filter),
  ]);
  return { data, total };
}

module.exports = {
  findOwnedCinemaIds,
  findFiltered,
  findByCode,
  findById,
  findCinemaById,
  create,
  updateFields,
  remove,
  recordUsage,
  findUsageHistory,
};
