import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/movies/components/FavoriteCinemaButton', () => ({
  FavoriteCinemaButton: () => <button>Fav</button>,
}));

const useCinemaDetailMock = vi.fn();
vi.mock('../hooks/useCinemaDetail', () => ({ useCinemaDetail: (...args: unknown[]) => useCinemaDetailMock(...args) }));

const useCinemaFavoriteCountMock = vi.fn();
vi.mock('../hooks/useCinemaFavoriteCount', () => ({
  useCinemaFavoriteCount: (...args: unknown[]) => useCinemaFavoriteCountMock(...args),
}));

import CinemaBannerDetail from './CinemaBannerDetail';

function renderWithId() {
  return render(
    <MemoryRouter initialEntries={['/Cinema/5']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/Cinema/:id" element={<CinemaBannerDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CinemaBannerDetail', () => {
  beforeEach(() => {
    useCinemaDetailMock.mockReset();
    useCinemaFavoriteCountMock.mockReset();
    useCinemaFavoriteCountMock.mockReturnValue({ data: 3 });
  });

  it('shows a spinner while the cinema has not loaded', () => {
    useCinemaDetailMock.mockReturnValue({ data: undefined });
    renderWithId();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the cinema name and status once loaded', () => {
    useCinemaDetailMock.mockReturnValue({
      data: { id: 5, name: 'Galaxy Cinema', address: 'Addr', city: 'HN', status: 1, images: [] },
    });
    renderWithId();
    expect(screen.getByText('Galaxy Cinema')).toBeInTheDocument();
    expect(screen.getByText('bannerDetail.statusActive')).toBeInTheDocument();
  });
});
