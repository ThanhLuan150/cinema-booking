import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: () => useMoviesMock() }));

import NowShowingSidebar from './NowShowingSidebar';

function renderSidebar() {
  return render(
    <MemoryRouter
      initialEntries={['/Detail/5']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/Detail/:id" element={<NowShowingSidebar />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NowShowingSidebar', () => {
  beforeEach(() => useMoviesMock.mockReset());

  it('renders nothing when the only playing movie is the one being viewed', () => {
    useMoviesMock.mockReturnValue({
      data: { data: [{ id: 5, name: 'Current', avatar: '', categories: [] }] },
    });
    const { container } = renderSidebar();
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the other playing movies', () => {
    useMoviesMock.mockReturnValue({
      data: {
        data: [
          { id: 5, name: 'Current', avatar: '', categories: [] },
          { id: 6, name: 'Another', avatar: '', categories: [] },
        ],
      },
    });
    renderSidebar();
    expect(screen.getByText('Another')).toBeInTheDocument();
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
  });
});
