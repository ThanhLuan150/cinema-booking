require('dotenv').config();

const connectDB = require('../config/db');
const seedRbac = require('./seedRbac');
const seedPositions = require('./seedPositions');

// Ticket 42 migration for an existing database: renames COMBO_STAFF -> CONCESSION_STAFF and
// TICKET_CHECKER -> CHECK_IN_STAFF in place (employees keep their assignment), then re-runs the
// RBAC and Position seeds so the new permissions (incident.*) and the new Positions (USHER,
// FNB_STAFF) exist. Idempotent — safe to run more than once.
async function run() {
  await connectDB();

  const renamed = await seedPositions.renameLegacyPositions();
  for (const { from, to, merged } of renamed) {
    console.log(`Renamed position ${from} -> ${to}${merged ? ' (merged into existing position)' : ''}`);
  }
  if (renamed.length === 0) console.log('No legacy position codes to rename.');

  await seedRbac();
  await seedPositions();

  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
