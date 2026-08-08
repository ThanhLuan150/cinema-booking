const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const employeeSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    user_id: { type: Number, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    employee_code: { type: String, required: true, unique: true, index: true },
    position_id: { type: Number, required: true, index: true },
    hire_date: { type: Date, default: Date.now },
    status: { type: Number, default: 1 }, // 1 = active, 0 = deactivated
  },
  { timestamps: true },
);

withCleanJSON(employeeSchema);

module.exports = mongoose.model('Employee', employeeSchema);
