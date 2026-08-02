import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useIsAuthenticated: () => useIsAuthenticatedMock() }));

const useLikeStatusMock = vi.fn();
vi.mock('../hooks/useLikeStatus', () => ({ useLikeStatus: () => useLikeStatusMock() }));

const useMyLikedMoviesMock = vi.fn();
vi.mock('../hooks/useMyLikedMovies', () => ({ useMyLikedMovies: () => useMyLikedMoviesMock() }));

const likeMutate = vi.fn();
const unlikeMutate = vi.fn();
vi.mock('../hooks/useLikeMutation', () => ({ useLikeMutation: () => ({ mutate: likeMutate }) }));
vi.mock('../hooks/useUnlikeMutation', () => ({ useUnlikeMutation: () => ({ mutate: unlikeMutate }) }));

import Like from './Like';

describe('Like', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    useIsAuthenticatedMock.mockReset();
    useLikeStatusMock.mockReset();
    useMyLikedMoviesMock.mockReset();
    likeMutate.mockReset();
    unlikeMutate.mockReset();
    useLikeStatusMock.mockReturnValue({ data: 3 });
    useMyLikedMoviesMock.mockReturnValue({ data: [] });
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, href: '' } as Location,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: originalLocation,
    });
  });

  it('shows the like count', () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    render(<Like movieId={1} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('redirects to login when clicked while logged out', () => {
    useIsAuthenticatedMock.mockReturnValue(false);
    render(<Like movieId={1} />);
    fireEvent.click(screen.getByRole('button'));
    expect(window.location.href).toBe('/Login');
    expect(likeMutate).not.toHaveBeenCalled();
  });

  it('likes the movie when not yet liked', () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    render(<Like movieId={5} />);
    fireEvent.click(screen.getByRole('button'));
    expect(likeMutate).toHaveBeenCalledWith({ movie_id: 5 }, expect.any(Object));
  });

  it('unlikes the movie when already liked', () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    useMyLikedMoviesMock.mockReturnValue({ data: [{ id: 5 }] });
    render(<Like movieId={5} />);
    fireEvent.click(screen.getByRole('button'));
    expect(unlikeMutate).toHaveBeenCalledWith({ movie_id: 5 }, expect.any(Object));
  });
});
