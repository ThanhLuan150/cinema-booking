import { useParams } from 'react-router-dom';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { getMoviePosterUrl } from '@/utils';

/** Full-bleed artwork strip the poster card overlaps, like Galaxy's movie page. */
const MovieBackdrop = () => {
  const { id } = useParams<{ id: string }>();
  const { data: movie } = useMovieDetail(id);

  return (
    <div className="relative h-[220px] w-full overflow-hidden bg-surface-raised md:h-[300px]">
      {movie && (
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center blur-sm"
          style={{ backgroundImage: `url(${getMoviePosterUrl(movie.avatar)})` }}
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-main/60 via-main/50 to-main" />
    </div>
  );
};

export default MovieBackdrop;
