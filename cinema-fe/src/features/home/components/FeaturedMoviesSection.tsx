import { useTranslation } from 'react-i18next';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { SectionHeading } from '@/components/common/SectionHeading';
import { MovieCard } from '@/components/common/MovieCard';

const HOME_FEATURED_LIMIT = 10;
const FEATURED_GRID_SIZE = 4;

// Curated grid driven by the Movie Content Management "featured" flag (Ticket 34). Hits
// GET /api/movie?featured=true and hides itself entirely when nothing is flagged.
const FeaturedMoviesSection = () => {
  const { t } = useTranslation('home');
  const { data } = useMovies({ featured: true }, { limit: HOME_FEATURED_LIMIT });
  const movies = (data?.data ?? []).slice(0, FEATURED_GRID_SIZE);

  if (movies.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
      <SectionHeading title={t('featured.title')} />
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} ctaLabel={t('featured.viewDetails')} />
        ))}
      </div>
    </section>
  );
};

export default FeaturedMoviesSection;
