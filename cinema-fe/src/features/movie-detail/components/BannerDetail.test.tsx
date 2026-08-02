import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/movies/components/Like', () => ({ default: () => <button>Like</button> }));

const useMovieDetailMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovieDetail', () => ({
  useMovieDetail: (...args: unknown[]) => useMovieDetailMock(...args),
}));

import BannerDetail from './BannerDetail';

function renderWithId() {
  return render(
    <MemoryRouter initialEntries={['/Detail/5']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/Detail/:id" element={<BannerDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BannerDetail', () => {
  beforeEach(() => useMovieDetailMock.mockReset());

  it('shows a spinner while the movie has not loaded', () => {
    useMovieDetailMock.mockReturnValue({ data: undefined });
    renderWithId();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the movie name and description once loaded', () => {
    useMovieDetailMock.mockReturnValue({
      data: { id: 5, name: 'Movie A', description: 'Desc', premiere_date: '2026-01-01', country: 'US', avatar: '', categories: [] },
    });
    renderWithId();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });
});
