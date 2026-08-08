require('dotenv').config();

const connectDB = require('../config/db');
const Account = require('../models/Account');
const Category = require('../models/Category');
const Cinema = require('../models/Cinema');
const Room = require('../models/Room');
const Movie = require('../models/Movie');
const MovieCategory = require('../models/MovieCategory');
const Schedule = require('../models/Schedule');
const nextId = require('../utils/nextId');

const CATEGORIES = ['Action', 'Comedy', 'Drama', 'Horror', 'Romance'];
const ROOMS = ['Room 1', 'Room 2', 'Room 3'];

const MOVIES = [
  {
    name: 'The Last Horizon',
    avatar: 'https://picsum.photos/seed/last-horizon/400/600',
    premiere_date: '2026-07-20',
    description: 'A crew of explorers races against time to stop a collapsing star from destroying Earth.',
    country: 'USA',
    trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    categories: ['Action'],
  },
  {
    name: 'Midnight Laughter',
    avatar: 'https://picsum.photos/seed/midnight-laughter/400/600',
    premiere_date: '2026-07-22',
    description: 'Two rival stand-up comedians are forced to share a stage tour across the country.',
    country: 'USA',
    trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    categories: ['Comedy'],
  },
  {
    name: 'Rain in Autumn',
    avatar: 'https://picsum.photos/seed/rain-autumn/400/600',
    premiere_date: '2026-07-25',
    description: 'A quiet drama about a family reuniting after twenty years apart.',
    country: 'Vietnam',
    trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    categories: ['Drama'],
  },
  {
    name: 'The Silent House',
    avatar: 'https://picsum.photos/seed/silent-house/400/600',
    premiere_date: '2026-07-28',
    description: 'A family moves into an old house and discovers it remembers everyone who ever lived there.',
    country: 'Korea',
    trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    categories: ['Horror'],
  },
  {
    name: 'Two Hearts, One City',
    avatar: 'https://picsum.photos/seed/two-hearts/400/600',
    premiere_date: '2026-08-01',
    description: 'Two strangers keep crossing paths across the city until fate finally introduces them.',
    country: 'Vietnam',
    trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    categories: ['Romance', 'Comedy'],
  },
];

async function run() {
  await connectDB();

  const categoryByName = {};
  for (const name of CATEGORIES) {
    let cat = await Category.findOne({ name });
    if (!cat) {
      const id = await nextId('category');
      cat = await Category.create({ id, name });
      console.log(`Created category: ${name}`);
    }
    categoryByName[name] = cat;
  }

  const admin = await Account.findOne({ role: 0 }).sort({ id: 1 });
  if (!admin) {
    console.error('No admin account found — run seed.js first.');
    process.exit(1);
  }
  let defaultCinema = await Cinema.findOne({ owner_id: admin.id, name: 'Default Cinema' });
  if (!defaultCinema) {
    const id = await nextId('cinema');
    defaultCinema = await Cinema.create({ id, owner_id: admin.id, name: 'Default Cinema', status: 1 });
    console.log(`Created default cinema (id=${defaultCinema.id})`);
  }

  const rooms = [];
  for (const name of ROOMS) {
    let room = await Room.findOne({ name, cinema_id: defaultCinema.id });
    if (!room) {
      const id = await nextId('room');
      room = await Room.create({ id, cinema_id: defaultCinema.id, name });
      console.log(`Created room: ${name}`);
    }
    rooms.push(room);
  }

  let scheduleCount = 0;
  for (let i = 0; i < MOVIES.length; i++) {
    const m = MOVIES[i];
    let movie = await Movie.findOne({ name: m.name });
    if (!movie) {
      const id = await nextId('movie');
      movie = await Movie.create({
        id,
        name: m.name,
        avatar: m.avatar,
        premiere_date: m.premiere_date,
        description: m.description,
        country: m.country,
        trailer: m.trailer,
      });
      console.log(`Created movie: ${m.name} (id=${id})`);
    }

    for (const catName of m.categories) {
      const cat = categoryByName[catName];
      const exists = await MovieCategory.findOne({ movie_id: movie.id, cat_id: cat.id });
      if (!exists) {
        const id = await nextId('movieCategory');
        await MovieCategory.create({ id, movie_id: movie.id, cat_id: cat.id });
      }
    }

    const room = rooms[i % rooms.length];
    const exists = await Schedule.findOne({ movie_id: movie.id });
    if (!exists) {
      const id = await nextId('schedule');
      await Schedule.create({
        id,
        movie_id: movie.id,
        room_id: room.id,
        movie_date: m.premiere_date,
        time_begin: '19:00',
        time_end: '21:00',
        price: 90000,
      });
      scheduleCount++;
    }
  }

  console.log(`Seed complete. ${scheduleCount} schedule(s) created.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
