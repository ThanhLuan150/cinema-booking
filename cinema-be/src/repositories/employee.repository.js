const Employee = require('../models/Employee');

async function findActiveByAccountAndCinema(accountId, cinemaId) {
  return Employee.findOne({
    user_id: Number(accountId),
    branch_id: Number(cinemaId),
    status: 1,
  });
}

async function findByAccountId(accountId) {
  return Employee.findOne({ user_id: Number(accountId) });
}

async function findAll(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Employee.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Employee.countDocuments(filter),
  ]);
  return { data, total };
}

async function create({ id, user_id, branch_id, employee_code, position_id, hire_date }) {
  return Employee.create({ id, user_id, branch_id, employee_code, position_id, hire_date });
}

async function updateFields(id, updates) {
  return Employee.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function findById(id) {
  return Employee.findOne({ id: Number(id) });
}

async function findBranchIdByEmployeeId(employeeId) {
  const employee = await Employee.findOne({ id: Number(employeeId) });
  return employee ? employee.branch_id : null;
}

module.exports = {
  findActiveByAccountAndCinema,
  findByAccountId,
  findAll,
  create,
  updateFields,
  findById,
  findBranchIdByEmployeeId,
};
