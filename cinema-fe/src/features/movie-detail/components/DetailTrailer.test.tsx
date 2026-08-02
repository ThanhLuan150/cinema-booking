import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useMovieDetailMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovieDetail', () => ({
  useMovieDetail: (...args: unknown[]) => useMovieDetailMock(...args),
}));

import DetailTrailer from './DetailTrailer';

function renderWithId() {
  return render(
    <MemoryRouter initialEntries={['/Detail/5']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/Detail/:id" element={<DetailTrailer />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DetailTrailer', () => {
  beforeEach(() => useMovieDetailMock.mockReset());

  it('renders nothing when there is no trailer', () => {
    useMovieDetailMock.mockReturnValue({ data: { id: 5, name: 'A', trailer: '' } });
    const { container } = renderWithId();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a youtube iframe for a youtube trailer', () => {
    useMovieDetailMock.mockReturnValue({
      data: { id: 5, name: 'A', trailer: 'https://www.youtube.com/watch?v=abc123' },
    });
    renderWithId();
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('src')).toContain('abc123');
  });

  it('renders a video element for a video-file trailer', () => {
    useMovieDetailMock.mockReturnValue({
      data: { id: 5, name: 'A', trailer: 'https://example.com/trailer.mp4' },
    });
    renderWithId();
    expect(document.querySelector('video')).toBeInTheDocument();
  });
});
