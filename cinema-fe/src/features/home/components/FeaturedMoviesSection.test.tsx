import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: (...args: unknown[]) => useMoviesMock(...args) }));

import FeaturedMoviesSection from './FeaturedMoviesSection';

function renderSection() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <FeaturedMoviesSection />
    </MemoryRouter>,
  );
}

describe('FeaturedMoviesSection', () => {
  beforeEach(() => useMoviesMock.mockReset());

  it('requests only featured movies', () => {
    useMoviesMock.mockReturnValue({ data: { data: [] } });
    renderSection();
    expect(useMoviesMock).toHaveBeenCalledWith({ featured: true }, { limit: 10 });
  });

  it('renders nothing when no movies are flagged featured', () => {
    useMoviesMock.mockReturnValue({ data: { data: [] } });
    const { container } = renderSection();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a card per featured movie', () => {
    useMoviesMock.mockReturnValue({
      data: {
        data: [
          { id: 1, name: 'Featured A', avatar: '', categories: [] },
          { id: 2, name: 'Featured B', avatar: '', categories: [] },
        ],
      },
    });
    renderSection();
    expect(screen.getByText('featured.title')).toBeInTheDocument();
    expect(screen.getByText('Featured A')).toBeInTheDocument();
    expect(screen.getByText('Featured B')).toBeInTheDocument();
  });
});
