const { MongoMemoryServer } = require('mongodb-memory-server');
const { execSync } = require('child_process');

(async () => {
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  const uri = mongod.getUri();
  execSync('node src/seed/seed.js', { stdio: 'inherit', env: { ...process.env, MONGODB_URI: uri } });
  execSync('node src/seed/seedDemo.js', { stdio: 'inherit', env: { ...process.env, MONGODB_URI: uri } });
  await mongod.stop();
})();
