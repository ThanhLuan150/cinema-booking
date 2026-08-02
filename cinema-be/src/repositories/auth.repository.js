const Account = require('../models/Account');

async function findByEmailForLogin(email) {
  return Account.findOne({ email: email.toLowerCase() }).select('+password');
}

async function findByEmail(email) {
  return Account.findOne({ email: String(email).toLowerCase() });
}

async function findByFilter(filter) {
  return Account.find(filter);
}

async function findByEmailWithPassword(email) {
  return Account.findOne({ email: String(email).toLowerCase() }).select('+password');
}

async function createAccount(data) {
  return Account.create(data);
}

async function saveAccount(account) {
  await account.save();
  return account;
}

async function updateProfileByEmail(email, { name, phone }) {
  return Account.findOneAndUpdate({ email: String(email).toLowerCase() }, { $set: { name, phone } }, { new: true });
}

async function findByEmailWithOtp(email) {
  return Account.findOne({ email: email.toLowerCase() }).select('+otp +otpExpiresAt');
}

async function findByEmailWithOtpAndPassword(email) {
  return Account.findOne({ email: email.toLowerCase() }).select('+otp +otpExpiresAt +password');
}

async function findByIdWithPassword(accountId) {
  return Account.findOne({ id: accountId }).select('+password');
}

async function findById(accountId) {
  return Account.findOne({ id: Number(accountId) });
}

async function findByIdWithRefreshToken(accountId) {
  return Account.findOne({ id: Number(accountId) }).select('+refreshTokenHash +refreshTokenExpiresAt');
}

async function setRefreshToken(accountId, hash, expiresAt) {
  await Account.updateOne({ id: Number(accountId) }, { $set: { refreshTokenHash: hash, refreshTokenExpiresAt: expiresAt } });
}

async function clearRefreshToken(accountId) {
  await Account.updateOne({ id: Number(accountId) }, { $set: { refreshTokenHash: null, refreshTokenExpiresAt: null } });
}

module.exports = {
  findByEmailForLogin,
  findByEmail,
  findByFilter,
  findByEmailWithPassword,
  createAccount,
  saveAccount,
  updateProfileByEmail,
  findByEmailWithOtp,
  findByEmailWithOtpAndPassword,
  findByIdWithPassword,
  findById,
  findByIdWithRefreshToken,
  setRefreshToken,
  clearRefreshToken,
};
