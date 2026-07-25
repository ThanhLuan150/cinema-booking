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
    <div className="rounded-md bg-black/80 p-2 font-sans text-txt shadow-lg">
      <Input
        id="search"
        type="text"
        value={searchInfo}
        onChange={(e) => setSearchInfo(e.target.value)}
        className="rounded-full py-1"
      />
      {movies.map((movie) => (
        <div key={movie.id} className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
          <img
            alt=""
            src={getMoviePosterUrl(movie.avatar)}
            className="h-12 w-20 rounded object-cover"
          />
          <a href={ROUTES.movieDetail(movie.id)} className="text-txt no-underline hover:text-accent">
            {movie.name}
          </a>
        </div>
      ))}
    </div>
  );
}
