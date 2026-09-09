const Screen = require('../models/Screen');
const SignageContent = require('../models/SignageContent');
const SignageSchedule = require('../models/SignageSchedule');

// ---- Screens ---------------------------------------------------------------

async function findScreens(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Screen.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Screen.countDocuments(filter),
  ]);
  return { data, total };
}

async function findScreenById(id) {
  return Screen.findOne({ id: Number(id) });
}

async function findBranchIdByScreenId(id) {
  const screen = await Screen.findOne({ id: Number(id) });
  return screen ? screen.branch_id : null;
}

async function findScreenByDeviceId(deviceId) {
  return Screen.findOne({ device_id: deviceId });
}

async function findScreenByApiKeyHash(hash) {
  return Screen.findOne({ api_key_hash: hash });
}

async function touchScreenLastSeen(id, when = new Date()) {
  return Screen.updateOne({ id: Number(id) }, { $set: { last_seen_at: when } });
}

async function createScreen(data) {
  return Screen.create(data);
}

async function updateScreen(id, updates) {
  return Screen.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function removeScreen(id) {
  return Screen.deleteOne({ id: Number(id) });
}

// ---- Content -------------------------------------------------------------

async function findContent(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    SignageContent.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    SignageContent.countDocuments(filter),
  ]);
  return { data, total };
}

async function findContentById(id) {
  return SignageContent.findOne({ id: Number(id) });
}

async function findContentByIds(ids) {
  return SignageContent.find({ id: { $in: ids.map(Number) } });
}

async function findBranchIdByContentId(id) {
  const content = await SignageContent.findOne({ id: Number(id) });
  return content ? content.branch_id : null;
}

async function createContent(data) {
  return SignageContent.create(data);
}

async function updateContent(id, updates) {
  return SignageContent.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function removeContent(id) {
  return SignageContent.deleteOne({ id: Number(id) });
}

// ---- Schedules (playlist entries) --------------------------------------------

async function findSchedules(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    SignageSchedule.find(filter).sort({ priority: -1, start_at: 1, id: -1 }).skip(skip).limit(limit),
    SignageSchedule.countDocuments(filter),
  ]);
  return { data, total };
}

async function findScheduleById(id) {
  return SignageSchedule.findOne({ id: Number(id) });
}

async function createSchedule(data) {
  return SignageSchedule.create(data);
}

async function updateSchedule(id, updates) {
  return SignageSchedule.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function removeSchedule(id) {
  return SignageSchedule.deleteOne({ id: Number(id) });
}

async function countSchedulesForScreen(screenId) {
  return SignageSchedule.countDocuments({ screen_id: Number(screenId) });
}

async function countSchedulesForContent(contentId) {
  return SignageSchedule.countDocuments({ content_id: Number(contentId) });
}

// Playlist entries that are live for `screenId` at `at` (an active window covering the moment).
async function findLiveScheduleEntries(screenId, at) {
  return SignageSchedule.find({
    screen_id: Number(screenId),
    status: 'ACTIVE',
    start_at: { $lte: at },
    end_at: { $gte: at },
  }).sort({ priority: -1, start_at: 1, id: -1 });
}

module.exports = {
  findScreens,
  findScreenById,
  findBranchIdByScreenId,
  findScreenByDeviceId,
  findScreenByApiKeyHash,
  touchScreenLastSeen,
  createScreen,
  updateScreen,
  removeScreen,
  findContent,
  findContentById,
  findContentByIds,
  findBranchIdByContentId,
  createContent,
  updateContent,
  removeContent,
  findSchedules,
  findScheduleById,
  createSchedule,
  updateSchedule,
  removeSchedule,
  countSchedulesForScreen,
  countSchedulesForContent,
  findLiveScheduleEntries,
};
