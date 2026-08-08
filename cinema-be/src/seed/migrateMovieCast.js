// One-time migration: backfills Actor/Director/MovieActor/MovieDirector records from the
// legacy free-text `director`/`cast` fields that used to live on Movie. Those fields were
// dropped from the Movie schema when the relational Actor/Director catalog was introduced,
// but the raw data is still sitting in existing MongoDB documents (Mongoose just stopped
// reading it) — this script reads it via the raw collection and links it into the new tables.
require('dotenv').config();

const connectDB = require('../config/db');
const Movie = require('../models/Movie');
const Actor = require('../models/Actor');
const Director = require('../models/Director');
const MovieActor = require('../models/MovieActor');
const MovieDirector = require('../models/MovieDirector');
const nextId = require('../utils/nextId');

async function findOrCreateActor(cache, fullName) {
  const key = fullName.trim();
  if (cache.has(key)) return cache.get(key);

  let actor = await Actor.findOne({ full_name: key });
  if (!actor) {
    const id = await nextId('actor');
    actor = await Actor.create({ id, full_name: key });
    console.log(`Created actor: ${key}`);
  }
  cache.set(key, actor.id);
  return actor.id;
}

async function findOrCreateDirector(cache, fullName) {
  const key = fullName.trim();
  if (cache.has(key)) return cache.get(key);

  let director = await Director.findOne({ full_name: key });
  if (!director) {
    const id = await nextId('director');
    director = await Director.create({ id, full_name: key });
    console.log(`Created director: ${key}`);
  }
  cache.set(key, director.id);
  return director.id;
}

async function run() {
  await connectDB();

  const rawMovies = await Movie.collection.find({}).toArray();
  const actorCache = new Map();
  const directorCache = new Map();
  let directorLinks = 0;
  let actorLinks = 0;

  for (const raw of rawMovies) {
    const directorName = typeof raw.director === 'string' ? raw.director.trim() : '';
    if (directorName) {
      const directorId = await findOrCreateDirector(directorCache, directorName);
      const exists = await MovieDirector.findOne({ movie_id: raw.id, director_id: directorId });
      if (!exists) {
        const id = await nextId('movieDirector');
        await MovieDirector.create({ id, movie_id: raw.id, director_id: directorId });
        directorLinks += 1;
      }
    }

    const cast = Array.isArray(raw.cast) ? raw.cast : [];
    for (const member of cast) {
      const name = typeof member?.name === 'string' ? member.name.trim() : '';
      if (!name) continue;
      const actorId = await findOrCreateActor(actorCache, name);
      const exists = await MovieActor.findOne({ movie_id: raw.id, actor_id: actorId });
      if (!exists) {
        const id = await nextId('movieActor');
        await MovieActor.create({
          id,
          movie_id: raw.id,
          actor_id: actorId,
          character_name: member.role || '',
          is_lead: Boolean(member.isLead),
        });
        actorLinks += 1;
      }
    }
  }

  console.log(`Linked ${directorLinks} movie-director pair(s) and ${actorLinks} movie-actor pair(s).`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
