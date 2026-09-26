const mongoose = require('mongoose');

// Multi-document transactions only exist on a replica set / sharded cluster (MongoDB Atlas, or a
// local mongod started with --replSet). A standalone mongod — the default local dev database and
// the in-memory server most tests use — rejects them outright. So callers ask
// `runInTransaction`, which hands them a session when transactions are available and `null` when
// they are not, and write their unit of work to be correct either way: with a session the whole
// thing commits or rolls back together; without one they fall back on guarded, idempotent steps
// plus explicit compensation (see purchaseOrder.repository.receive).
let support = null;

async function detectSupport() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  return Boolean(hello.setName) || hello.msg === 'isdbgrid';
}

function supportsTransactions() {
  // Cached as a promise so concurrent first callers share one probe. A probe that throws (the
  // connection was not ready yet) is dropped from the cache so the next call asks again.
  if (!support) {
    support = detectSupport().catch((err) => {
      support = null;
      throw err;
    });
  }
  return support;
}

function resetTransactionSupportCache() {
  support = null;
}

// work(session|null) -> its result. With a session, `work` may be invoked more than once (the
// driver retries a transaction on a transient error), so it must be free of side effects other
// than database writes made through that session — broadcast/notify from the result instead.
async function runInTransaction(work) {
  if (!(await supportsTransactions())) return work(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { runInTransaction, supportsTransactions, resetTransactionSupportCache };
