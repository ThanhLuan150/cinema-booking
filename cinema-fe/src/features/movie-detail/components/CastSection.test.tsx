import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useMovieDetailMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovieDetail', () => ({
  useMovieDetail: (...args: unknown[]) => useMovieDetailMock(...args),
}));

import CastSection from './CastSection';

function renderWithId() {
  return render(
    <MemoryRouter initialEntries={['/Detail/5']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/Detail/:id" element={<CastSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CastSection', () => {
  beforeEach(() => useMovieDetailMock.mockReset());

  it('renders nothing when the movie has not loaded', () => {
    useMovieDetailMock.mockReturnValue({ data: undefined });
    const { container } = renderWithId();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no director, producer or cast', () => {
    useMovieDetailMock.mockReturnValue({ data: { id: 5, name: 'A' } });
    const { container } = renderWithId();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the director and cast list', () => {
    useMovieDetailMock.mockReturnValue({
      data: {
        id: 5,
        name: 'A',
        director: 'Jane Director',
        cast: [{ name: 'Actor One', role: 'Hero', avatar: '' }],
      },
    });
    renderWithId();
    expect(screen.getByText('Jane Director')).toBeInTheDocument();
    expect(screen.getByText('Actor One')).toBeInTheDocument();
  });
});
