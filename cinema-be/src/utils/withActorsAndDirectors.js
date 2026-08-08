const Actor = require('../models/Actor');
const Director = require('../models/Director');
const MovieActor = require('../models/MovieActor');
const MovieDirector = require('../models/MovieDirector');

// Attaches `actors` and `directors` arrays to each movie in a batched set of queries
// instead of querying per-movie (avoids N+1s on list endpoints). Mirrors withCategories.
async function withActorsAndDirectors(movies) {
  const movieIds = movies.map((movie) => movie.id);

  const [actorMappings, directorMappings] = await Promise.all([
    MovieActor.find({ movie_id: { $in: movieIds } }),
    MovieDirector.find({ movie_id: { $in: movieIds } }),
  ]);

  const [actors, directors] = await Promise.all([
    Actor.find({ id: { $in: actorMappings.map((m) => m.actor_id) } }),
    Director.find({ id: { $in: directorMappings.map((m) => m.director_id) } }),
  ]);
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const directorById = new Map(directors.map((director) => [director.id, director]));

  const actorsByMovieId = new Map();
  for (const mapping of actorMappings) {
    const actor = actorById.get(mapping.actor_id);
    if (!actor) continue;
    const list = actorsByMovieId.get(mapping.movie_id) || [];
    list.push({ ...actor.toJSON(), character_name: mapping.character_name, is_lead: mapping.is_lead });
    actorsByMovieId.set(mapping.movie_id, list);
  }

  const directorsByMovieId = new Map();
  for (const mapping of directorMappings) {
    const director = directorById.get(mapping.director_id);
    if (!director) continue;
    const list = directorsByMovieId.get(mapping.movie_id) || [];
    list.push(director.toJSON());
    directorsByMovieId.set(mapping.movie_id, list);
  }

  return movies.map((movie) => ({
    ...(movie.toJSON ? movie.toJSON() : movie),
    actors: actorsByMovieId.get(movie.id) || [],
    directors: directorsByMovieId.get(movie.id) || [],
  }));
}

module.exports = { withActorsAndDirectors };
