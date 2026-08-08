require('dotenv').config();
const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');
const Account = require('../models/Account');
const Category = require('../models/Category');
const Cinema = require('../models/Cinema');
const Room = require('../models/Room');
const nextId = require('../utils/nextId');
const seedRbac = require('./seedRbac');

const ADMIN_EMAIL = 'admin@cinema.local';
const ADMIN_PASSWORD = 'admin123';

const CATEGORIES = ['Action', 'Comedy', 'Drama', 'Horror', 'Romance'];
const ROOMS = ['Room 1', 'Room 2', 'Room 3'];

async function seed() {
  await connectDB();

  // Admin account
  let admin = await Account.findOne({ email: ADMIN_EMAIL });
  if (!admin) {
    const id = await nextId('account');
    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
    admin = await Account.create({
      id,
      email: ADMIN_EMAIL,
      password: hashed,
      name: 'Administrator',
      phone: '0000000000',
      role: 0,
      status: 1,
      verified: true,
    });
    console.log(`Created admin account -> email: ${ADMIN_EMAIL} / password: ${ADMIN_PASSWORD}`);
  } else {
    console.log('Admin account already exists, skipping.');
  }

  await seedRbac();

  // Categories
  for (const name of CATEGORIES) {
    const exists = await Category.findOne({ name });
    if (!exists) {
      const id = await nextId('category');
      await Category.create({ id, name });
      console.log(`Created category: ${name}`);
    }
  }

  // Default cinema (rooms require a cinema_id) — owned by the admin account.
  let defaultCinema = await Cinema.findOne({ owner_id: admin.id, name: 'Default Cinema' });
  if (!defaultCinema) {
    const id = await nextId('cinema');
    defaultCinema = await Cinema.create({ id, owner_id: admin.id, name: 'Default Cinema', status: 1 });
    console.log(`Created default cinema (id=${defaultCinema.id})`);
  }

  // Rooms
  for (const name of ROOMS) {
    const exists = await Room.findOne({ name, cinema_id: defaultCinema.id });
    if (!exists) {
      const id = await nextId('room');
      await Room.create({ id, cinema_id: defaultCinema.id, name });
      console.log(`Created room: ${name}`);
    }
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
