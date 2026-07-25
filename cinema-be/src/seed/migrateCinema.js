require('dotenv').config();

const connectDB = require('../config/db');
const Account = require('../models/Account');
const Cinema = require('../models/Cinema');
const Room = require('../models/Room');
const Seat = require('../models/Seat');
const nextId = require('../utils/nextId');

const ROWS = ['A', 'B', 'C', 'D', 'E'];
const SEATS_PER_ROW = 8;

async function ensureDefaultSeatMap(room) {
  const existing = await Seat.countDocuments({ room_id: room.id });
  if (existing > 0) return 0;

  const seats = [];
  for (const row of ROWS) {
    for (let col = 1; col <= SEATS_PER_ROW; col += 1) {
      const id = await nextId('seat');
      seats.push({ id, room_id: room.id, seat_code: `${row}${col}`, seat_type: 0, is_locked: false });
    }
  }
  await Seat.insertMany(seats);
  return seats.length;
}

async function run() {
  await connectDB();

  const roomsWithoutCinema = await Room.find({ cinema_id: { $exists: false } });
  if (roomsWithoutCinema.length > 0) {
    const admin = await Account.findOne({ role: 0 }).sort({ id: 1 });
    if (!admin) {
      console.error('No admin account found — run the seed script first.');
      process.exit(1);
    }

    let cinema = await Cinema.findOne({ owner_id: admin.id, name: 'Default Cinema' });
    if (!cinema) {
      const id = await nextId('cinema');
      cinema = await Cinema.create({
        id,
        owner_id: admin.id,
        name: 'Default Cinema',
        address: '',
        city: '',
        status: 1,
      });
      console.log(`Created default cinema (id=${cinema.id}) owned by admin account ${admin.id}`);
    }

    const result = await Room.updateMany(
      { cinema_id: { $exists: false } },
      { $set: { cinema_id: cinema.id } },
    );
    console.log(`Attached ${result.modifiedCount} room(s) to cinema ${cinema.id}`);
  } else {
    console.log('No rooms need cinema attachment.');
  }

  const allRooms = await Room.find();
  let seatsCreated = 0;
  for (const room of allRooms) {
    seatsCreated += await ensureDefaultSeatMap(room);
  }
  console.log(`Created ${seatsCreated} seat(s) across rooms missing a seat map.`);

  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
