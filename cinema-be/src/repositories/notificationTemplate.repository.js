const NotificationTemplate = require('../models/NotificationTemplate');
const nextId = require('../utils/nextId');

// Ticket 26 — persistence for notification templates. Thin CRUD; all validation and rendering
// lives in services/notificationTemplate.service. A unique (event, channel, language) index on
// the model turns a duplicate into an E11000 the controller surfaces as 409.

async function create(data) {
  const doc = { id: await nextId('notificationTemplate'), ...data };
  return NotificationTemplate.create(doc);
}

async function findById(id) {
  return NotificationTemplate.findOne({ id: Number(id) });
}

async function findByKey({ event, channel, language }) {
  return NotificationTemplate.findOne({ event, channel, language });
}

// The one ACTIVE template for this event/channel/language, or null. Used by the notifier.
async function findActive({ event, channel, language }) {
  return NotificationTemplate.findOne({
    event,
    channel,
    language,
    status: NotificationTemplate.STATUS.ACTIVE,
  });
}

async function findFiltered({ event, channel, language, status } = {}, { skip = 0, limit = 20 } = {}) {
  const filter = {};
  if (event) filter.event = event;
  if (channel) filter.channel = channel;
  if (language) filter.language = language;
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    NotificationTemplate.find(filter).sort({ event: 1, channel: 1, language: 1 }).skip(skip).limit(limit),
    NotificationTemplate.countDocuments(filter),
  ]);
  return { data, total };
}

async function updateById(id, updates) {
  return NotificationTemplate.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function deleteById(id) {
  return NotificationTemplate.findOneAndDelete({ id: Number(id) });
}

module.exports = {
  create,
  findById,
  findByKey,
  findActive,
  findFiltered,
  updateById,
  deleteById,
};
