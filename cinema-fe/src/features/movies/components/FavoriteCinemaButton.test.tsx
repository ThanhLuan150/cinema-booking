import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useIsAuthenticated: () => useIsAuthenticatedMock() }));

const useFavoriteCinemasMock = vi.fn();
vi.mock('../hooks/useFavoriteCinemas', () => ({ useFavoriteCinemas: () => useFavoriteCinemasMock() }));

const favoriteMutate = vi.fn();
const unfavoriteMutate = vi.fn();
vi.mock('../hooks/useFavoriteCinemaMutation', () => ({ useFavoriteCinemaMutation: () => ({ mutate: favoriteMutate }) }));
vi.mock('../hooks/useUnfavoriteCinemaMutation', () => ({
  useUnfavoriteCinemaMutation: () => ({ mutate: unfavoriteMutate }),
}));

import { FavoriteCinemaButton } from './FavoriteCinemaButton';

describe('FavoriteCinemaButton', () => {
  beforeEach(() => {
    useIsAuthenticatedMock.mockReset();
    useFavoriteCinemasMock.mockReset();
    favoriteMutate.mockReset();
    unfavoriteMutate.mockReset();
    useIsAuthenticatedMock.mockReturnValue(true);
  });

  it('favorites the cinema when not yet favorited', () => {
    useFavoriteCinemasMock.mockReturnValue({ data: [] });
    render(<FavoriteCinemaButton cinemaId={5} />);
    fireEvent.click(screen.getByRole('button'));
    expect(favoriteMutate).toHaveBeenCalledWith(5, expect.any(Object));
  });

  it('unfavorites the cinema when already favorited', () => {
    useFavoriteCinemasMock.mockReturnValue({ data: [{ id: 5 }] });
    render(<FavoriteCinemaButton cinemaId={5} />);
    fireEvent.click(screen.getByRole('button'));
    expect(unfavoriteMutate).toHaveBeenCalledWith(5, expect.any(Object));
  });

  it('shows the filled heart icon when favorited', () => {
    useFavoriteCinemasMock.mockReturnValue({ data: [{ id: 5 }] });
    render(<FavoriteCinemaButton cinemaId={5} />);
    expect(document.querySelector('.fa-solid.fa-heart')).toBeInTheDocument();
  });
});
