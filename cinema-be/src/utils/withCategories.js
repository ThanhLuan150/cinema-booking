const Category = require('../models/Category');
const MovieCategory = require('../models/MovieCategory');

// Attaches a `categories` array to each movie in one batched pair of queries
// instead of querying per-movie (avoids N+1s on list endpoints).
async function withCategories(movies) {
  const movieIds = movies.map((movie) => movie.id);
  const mappings = await MovieCategory.find({ movie_id: { $in: movieIds } });
  const categories = await Category.find({ id: { $in: mappings.map((m) => m.cat_id) } }).sort({ id: 1 });
  const categoryById = new Map(categories.map((cat) => [cat.id, cat]));

  const categoriesByMovieId = new Map();
  for (const mapping of mappings) {
    const category = categoryById.get(mapping.cat_id);
    if (!category) continue;
    const list = categoriesByMovieId.get(mapping.movie_id) || [];
    list.push(category);
    categoriesByMovieId.set(mapping.movie_id, list);
  }

  return movies.map((movie) => ({
    ...(movie.toJSON ? movie.toJSON() : movie),
    categories: categoriesByMovieId.get(movie.id) || [],
  }));
}

module.exports = { withCategories };
