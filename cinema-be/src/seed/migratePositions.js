require('dotenv').config();

const connectDB = require('../config/db');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const nextId = require('../utils/nextId');

const DEFAULT_POSITION_CODE = 'TICKET_STAFF';

async function run() {
  await connectDB();

  const defaultPosition = await Position.findOne({ code: DEFAULT_POSITION_CODE });
  if (!defaultPosition) {
    console.error(`Position "${DEFAULT_POSITION_CODE}" not found — run "yarn seed" first.`);
    process.exit(1);
  }

  const employeesWithoutPosition = await Employee.find({ position_id: { $exists: false } });
  for (const employee of employeesWithoutPosition) {
    await Employee.updateOne({ id: employee.id }, { $set: { position_id: defaultPosition.id } });
  }
  console.log(`Assigned default position "${DEFAULT_POSITION_CODE}" to ${employeesWithoutPosition.length} employee(s).`);

  const employeesWithoutCode = await Employee.find({ employee_code: { $exists: false } });
  for (const employee of employeesWithoutCode) {
    const employeeCode = `EMP-${String(employee.id).padStart(6, '0')}`;
    await Employee.updateOne({ id: employee.id }, { $set: { employee_code: employeeCode } });
  }
  console.log(`Generated employee_code for ${employeesWithoutCode.length} employee(s).`);

  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
