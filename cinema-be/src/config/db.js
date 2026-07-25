const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinema_booking';
  mongoose.connection.on('connected', () => {
    console.log(`[mongo] connected -> ${uri}`);
  });
  mongoose.connection.on('error', (err) => {
    console.error('[mongo] connection error:', err.message);
  });
  await mongoose.connect(uri);
}

module.exports = connectDB;
