const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// GENERAL: routine assistance. COMPLAINT: a customer grievance ("xử lý complaint"). The others
// tag what the contact was about so Customer Service reporting can break volume down by reason.
const CATEGORIES = ['GENERAL', 'COMPLAINT', 'BOOKING_SUPPORT', 'REFUND_SUPPORT', 'SHOWTIME_CHANGE'];

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const supportTicketSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    customer_id: { type: Number, required: true, index: true }, // Account id of the customer this ticket concerns
    branch_id: { type: Number, required: true, index: true },
    category: { type: String, enum: CATEGORIES, default: 'GENERAL' },
    subject: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: STATUSES, default: 'OPEN', index: true },
    created_by: { type: Number, required: true }, // Account id of the staff member who opened it
    assigned_employee_id: { type: Number, default: null },
    assigned_by: { type: Number, default: null },
    assigned_at: { type: Date, default: null },
    resolution_note: { type: String, default: null },
    resolved_at: { type: Date, default: null },
    closed_at: { type: Date, default: null },
    closed_by: { type: Number, default: null },
  },
  { timestamps: true },
);

withCleanJSON(supportTicketSchema);

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
SupportTicket.CATEGORIES = CATEGORIES;
SupportTicket.STATUSES = STATUSES;

module.exports = SupportTicket;
