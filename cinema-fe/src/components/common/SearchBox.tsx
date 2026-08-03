import { useEffect, useState } from 'react';
import apiClient from 'services/apiClient';
import { Input } from '@/components/ui/Input';
import type { Movie } from '@/types/entities';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';

export function SearchBox() {
  const [searchInfo, setSearchInfo] = useState('');
  const [movies, setMovies] = useState<Movie[]>([]);

  const fetchMovies = (search: string) => {
    apiClient
      .get('/movie', { params: { search } })
      .then((response) => response.data)
      .then((data: Movie[]) => {
        if (data.length > 0) {
          const filteredMovies = data.filter((movie) =>
            movie.name.toLowerCase().startsWith(search.toLowerCase()),
          );
          setMovies(filteredMovies);
        } else {
          setMovies([]);
        }
      })
      .catch((error) => console.log(error));
  };

  useEffect(() => {
    if (searchInfo.trim() !== '') {
      fetchMovies(searchInfo);
    } else {
      setMovies([]);
    }
  }, [searchInfo]);

  return (
    <div className="themed-scrollbar max-h-[70vh] overflow-y-auto rounded-xl border border-border-strong bg-surface-raised p-3 font-sans text-txt shadow-raised">
      <Input
        id="search"
        type="text"
        value={searchInfo}
        onChange={(e) => setSearchInfo(e.target.value)}
        className="rounded-full"
      />
      {movies.map((movie) => (
        <a
          key={movie.id}
          href={ROUTES.movieDetail(movie.id)}
          className="mt-2 flex items-center gap-3 rounded-lg border-t border-border p-1.5 pt-3 no-underline transition-colors hover:bg-white/5"
        >
          <img
            alt=""
            src={getMoviePosterUrl(movie.avatar)}
            className="h-14 w-10 rounded-md object-cover shadow-card"
          />
          <span className="text-sm font-medium text-txt hover:text-accent">{movie.name}</span>
        </a>
      ))}
    </div>
  );
}
