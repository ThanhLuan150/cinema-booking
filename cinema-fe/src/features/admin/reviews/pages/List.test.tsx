import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: any) =>
        key === 'reviews.headers' && opts?.returnObjects ? ['ID', 'Target', 'Rating', 'Comment', 'Status', 'Actions'] : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useAdminReviewsMock = vi.fn();
vi.mock('../hooks/useAdminReviews', () => ({ useAdminReviews: (...args: unknown[]) => useAdminReviewsMock(...args) }));

const hideMutate = vi.fn();
const rejectMutate = vi.fn();
const restoreMutate = vi.fn();
const deleteMutate = vi.fn();
vi.mock('../hooks/useReviewModeration', () => ({
  useHideReview: () => ({ mutateAsync: hideMutate }),
  useRejectReview: () => ({ mutateAsync: rejectMutate }),
  useRestoreReview: () => ({ mutateAsync: restoreMutate }),
  useDeleteReview: () => ({ mutateAsync: deleteMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import AdminReviewsList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminReviewsList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Admin Reviews List', () => {
  beforeEach(() => {
    useAdminReviewsMock.mockReset();
    hideMutate.mockReset();
    rejectMutate.mockReset();
    restoreMutate.mockReset();
    deleteMutate.mockReset();
    confirmDialogMock.mockReset();
  });

  it('renders a review row', () => {
    useAdminReviewsMock.mockReturnValue({
      data: { data: [{ id: 1, movie: { name: 'Movie A' }, rating: 4, comment: 'Nice', status: 'VISIBLE', reportCount: 0 }], totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('Nice')).toBeInTheDocument();
  });

  it('shows hide and reject actions for a visible review, and hides them once moderated', () => {
    useAdminReviewsMock.mockReturnValue({
      data: {
        data: [
          { id: 1, movie: { name: 'Movie A' }, rating: 4, comment: 'Nice', status: 'VISIBLE', reportCount: 0 },
          { id: 2, movie: { name: 'Movie B' }, rating: 2, comment: 'Meh', status: 'HIDDEN', reportCount: 0 },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getAllByText('reviews.hideButton')).toHaveLength(1);
    expect(screen.getAllByText('reviews.rejectButton')).toHaveLength(1);
    expect(screen.getAllByText('reviews.restoreButton')).toHaveLength(1);
  });

  it('hides a review', async () => {
    useAdminReviewsMock.mockReturnValue({
      data: { data: [{ id: 1, movie: { name: 'Movie A' }, rating: 4, comment: 'Nice', status: 'VISIBLE', reportCount: 0 }], totalPages: 1 },
    });
    hideMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('reviews.hideButton'));
    await vi.waitFor(() => expect(hideMutate).toHaveBeenCalledWith(1));
  });

  it('rejects a review', async () => {
    useAdminReviewsMock.mockReturnValue({
      data: { data: [{ id: 1, movie: { name: 'Movie A' }, rating: 4, comment: 'Nice', status: 'VISIBLE', reportCount: 0 }], totalPages: 1 },
    });
    rejectMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('reviews.rejectButton'));
    await vi.waitFor(() => expect(rejectMutate).toHaveBeenCalledWith(1));
  });

  it('restores a hidden review', async () => {
    useAdminReviewsMock.mockReturnValue({
      data: { data: [{ id: 1, movie: { name: 'Movie A' }, rating: 4, comment: 'Nice', status: 'HIDDEN', reportCount: 0 }], totalPages: 1 },
    });
    restoreMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('reviews.restoreButton'));
    await vi.waitFor(() => expect(restoreMutate).toHaveBeenCalledWith(1));
  });

  it('deletes a review after confirming', async () => {
    useAdminReviewsMock.mockReturnValue({
      data: { data: [{ id: 1, movie: { name: 'Movie A' }, rating: 4, comment: 'Nice', status: 'REJECTED', reportCount: 2 }], totalPages: 1 },
    });
    confirmDialogMock.mockResolvedValue(true);
    deleteMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('reviews.deleteButton'));
    await vi.waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(1));
  });
});
