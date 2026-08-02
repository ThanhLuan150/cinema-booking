import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: () => useMoviesMock() }));

import Banner from './BannerSlider';

describe('BannerSlider', () => {
  beforeEach(() => useMoviesMock.mockReset());

  it('renders nothing when there are no movies', () => {
    useMoviesMock.mockReturnValue({ data: { data: [] } });
    const { container } = render(<Banner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a banner slide for each movie (up to 5)', () => {
    useMoviesMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Movie A', description: 'Desc', avatar: '', categories: [] }] },
    });
    render(<Banner />);
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });
});
