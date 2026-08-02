import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useIsAuthenticatedMock = vi.fn();
const useCurrentAccountIdMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useIsAuthenticated: () => useIsAuthenticatedMock(),
  useCurrentAccountId: () => useCurrentAccountIdMock(),
}));

const useCinemaReviewsMock = vi.fn();
vi.mock('../hooks/useCinemaReviews', () => ({ useCinemaReviews: (...args: unknown[]) => useCinemaReviewsMock(...args) }));

const postReviewMutate = vi.fn();
vi.mock('../hooks/usePostCinemaReview', () => ({
  usePostCinemaReview: () => ({ mutateAsync: postReviewMutate, isPending: false }),
}));
vi.mock('../hooks/usePostCinemaReply', () => ({ usePostCinemaReply: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('../hooks/useReactToCinemaReview', () => ({ useReactToCinemaReview: () => ({ mutate: vi.fn() }) }));
vi.mock('../hooks/useUpdateReview', () => ({ useUpdateReview: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('../hooks/useDeleteReview', () => ({ useDeleteReview: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('../hooks/useReportReview', () => ({ useReportReview: () => ({ mutateAsync: vi.fn() }) }));

import CinemaReviews from './CinemaReviews';

function renderWithId() {
  return render(
    <MemoryRouter initialEntries={['/Cinema/5']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/Cinema/:id" element={<CinemaReviews />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CinemaReviews', () => {
  beforeEach(() => {
    useIsAuthenticatedMock.mockReset();
    useCurrentAccountIdMock.mockReset();
    useCinemaReviewsMock.mockReset();
    postReviewMutate.mockReset();
    useCurrentAccountIdMock.mockReturnValue(1);
  });

  it('shows an empty state when there are no reviews', () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    useCinemaReviewsMock.mockReturnValue({ data: { reviews: [], average: 0, count: 0 }, isLoading: false });
    renderWithId();
    expect(screen.getByText('reviews.emptyState')).toBeInTheDocument();
  });

  it('renders existing reviews', () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    useCinemaReviewsMock.mockReturnValue({
      data: {
        reviews: [
          {
            id: 1,
            author: { id: 2, name: 'Bob', avatar: '' },
            createdAt: '2026-01-01T00:00:00.000Z',
            comment: 'Great cinema',
            rating: 5,
            reactions: { counts: {}, total: 0, mine: null },
          },
        ],
        average: 5,
        count: 1,
      },
      isLoading: false,
    });
    renderWithId();
    expect(screen.getByText('Great cinema')).toBeInTheDocument();
  });

  it('submits a review when logged in', async () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    useCinemaReviewsMock.mockReturnValue({ data: { reviews: [], average: 0, count: 0 }, isLoading: false });
    postReviewMutate.mockResolvedValue({});
    renderWithId();
    const textarea = screen.getByPlaceholderText('reviews.commentPlaceholder');
    fireEvent.change(textarea, { target: { value: 'Nice!' } });
    fireEvent.click(screen.getByText('reviews.submit'));
    await waitFor(() =>
      expect(postReviewMutate).toHaveBeenCalledWith(
        expect.objectContaining({ cinema_id: 5, comment: 'Nice!' }),
      ),
    );
    await waitFor(() => expect(textarea).toHaveValue(''));
  });
});
