import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerGiftCardsReducer from '../../store/ownerGiftCardsSlice';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMyCinemasMock = vi.fn();
vi.mock('../../hooks/useMyCinemas', () => ({
  useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args),
}));

const useOwnerGiftCardsMock = vi.fn();
vi.mock('../../hooks/useOwnerGiftCards', () => ({
  useOwnerGiftCards: (...args: unknown[]) => useOwnerGiftCardsMock(...args),
}));

const useGiftCardHistoryMock = vi.fn();
vi.mock('../hooks/useGiftCardHistory', () => ({
  useGiftCardHistory: (...args: unknown[]) => useGiftCardHistoryMock(...args),
}));

const createGiftCardMutate = vi.fn();
const blockGiftCardMutate = vi.fn();
vi.mock('../../hooks/useGiftCardMutations', () => ({
  useCreateGiftCard: () => ({ mutateAsync: createGiftCardMutate, isPending: false }),
  useBlockGiftCard: () => ({ mutateAsync: blockGiftCardMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import GiftCardList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerGiftCards: ownerGiftCardsReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GiftCardList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Gift Cards List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useOwnerGiftCardsMock.mockReset();
    useGiftCardHistoryMock.mockReset();
    createGiftCardMutate.mockReset();
    blockGiftCardMutate.mockReset();
    confirmDialogMock.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
    useGiftCardHistoryMock.mockReturnValue({ data: { data: [], totalPages: 1 }, isLoading: false });
  });

  it('renders gift card rows with cinema name, balance and status', () => {
    useOwnerGiftCardsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            cinema_id: 1,
            code: 'GC100',
            initial_balance: 100000,
            remaining_balance: 60000,
            owner_account_id: 42,
            status: 'ACTIVE',
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('GC100')).toBeInTheDocument();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('giftCards.status.ACTIVE')).toBeInTheDocument();
  });

  it('blocks a gift card after confirming', async () => {
    useOwnerGiftCardsMock.mockReturnValue({
      data: {
        data: [{ id: 1, cinema_id: 1, code: 'GC100', initial_balance: 1000, remaining_balance: 1000, owner_account_id: null, status: 'ACTIVE' }],
        totalPages: 1,
      },
    });
    confirmDialogMock.mockResolvedValue(true);
    blockGiftCardMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('giftCards.block'));
    await waitFor(() => expect(blockGiftCardMutate).toHaveBeenCalledWith(1));
  });

  it('opens the issue-gift-card modal from the add button', () => {
    useOwnerGiftCardsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('giftCards.addButton'));
    expect(screen.getByText('giftCards.addTitle')).toBeInTheDocument();
  });
});
