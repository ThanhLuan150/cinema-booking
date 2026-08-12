const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const shiftAssignmentSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    employee_id: { type: Number, required: true, index: true },
    shift_id: { type: Number, required: true, index: true },
    // Denormalized from the employee/shift's shared branch (they're required to match) so
    // branch-scoped queries — and a future Attendance module — don't need a join to filter.
    branch_id: { type: Number, required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    start_at: { type: Date, required: true },
    end_at: { type: Date, required: true },
    status: { type: String, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

shiftAssignmentSchema.index({ employee_id: 1, date: 1 });

withCleanJSON(shiftAssignmentSchema);

module.exports = mongoose.model('ShiftAssignment', shiftAssignmentSchema);
