const { MongoMemoryServer, MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

// `replSet: true` starts a single-node replica set instead of a standalone server — the only way to
// exercise real multi-document transactions (a standalone mongod rejects them).
async function connect({ replSet = false } = {}) {
  mongod = replSet
    ? await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 30000 }] })
    : await MongoMemoryServer.create({ instance: { launchTimeout: 30000 } });
  await mongoose.connect(mongod.getUri());
}

async function closeDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
}

async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connect, closeDatabase, clearDatabase };
