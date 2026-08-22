import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerHolidaysReducer from '../../store/ownerHolidaysSlice';

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
vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuthRole: () => undefined }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMyCinemasMock = vi.fn();
vi.mock('../../hooks/useMyCinemas', () => ({ useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args) }));

const useOwnerHolidaysMock = vi.fn();
vi.mock('../../hooks/useOwnerHolidays', () => ({
  useOwnerHolidays: (...args: unknown[]) => useOwnerHolidaysMock(...args),
}));

const createHolidayMutate = vi.fn();
const deleteHolidayMutate = vi.fn();
vi.mock('../../hooks/useHolidayMutations', () => ({
  useCreateHoliday: () => ({ mutateAsync: createHolidayMutate, isPending: false }),
  useDeleteHoliday: () => ({ mutateAsync: deleteHolidayMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import HolidayList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerHolidays: ownerHolidaysReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <HolidayList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Holidays List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useOwnerHolidaysMock.mockReset();
    createHolidayMutate.mockReset();
    deleteHolidayMutate.mockReset();
    confirmDialogMock.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
  });

  it('renders holiday rows with branch and date', () => {
    useOwnerHolidaysMock.mockReturnValue({
      data: { data: [{ id: 1, date: '2026-12-25', name: 'Christmas', branch_id: null }], totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('Christmas')).toBeInTheDocument();
    expect(screen.getByText('2026-12-25')).toBeInTheDocument();
    expect(screen.getByText('holidays.allBranchesOption')).toBeInTheDocument();
  });

  it('opens the add-holiday modal from the add button', () => {
    useOwnerHolidaysMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('holidays.addButton'));
    expect(screen.getByText('holidays.addTitle')).toBeInTheDocument();
  });

  // The date field uses the shared DateInput calendar picker (not a native <input type="date">).
  // DateInput has no value to seed the calendar with in the empty Add form, so it opens on the
  // real current month; picking "1" from the following month keeps the target date deterministic
  // without depending on which day the suite happens to run on.
  function pickNextMonthFirstFromCalendar(label: string) {
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    fireEvent.click(screen.getByLabelText(label));
    fireEvent.click(screen.getByLabelText('Next month'));
    fireEvent.click(screen.getByRole('gridcell', { name: '1' }));
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  it('fills the date via the DateInput picker and creates the holiday with it', async () => {
    useOwnerHolidaysMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    createHolidayMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('holidays.addButton'));

    const expectedDate = pickNextMonthFirstFromCalendar('holidays.dateLabel');
    fireEvent.change(document.querySelector('input[name="name"]')!, { target: { value: 'Founding Day' } });

    fireEvent.click(screen.getByText('holidays.submit'));

    await waitFor(() =>
      expect(createHolidayMutate).toHaveBeenCalledWith({
        date: expectedDate,
        name: 'Founding Day',
        branch_id: 1,
      }),
    );
  });

  it('deletes a holiday after confirming', async () => {
    useOwnerHolidaysMock.mockReturnValue({
      data: { data: [{ id: 1, date: '2026-12-25', name: 'Christmas', branch_id: null }], totalPages: 1 },
    });
    confirmDialogMock.mockResolvedValue(true);
    deleteHolidayMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('holidays.delete'));
    await waitFor(() => expect(deleteHolidayMutate).toHaveBeenCalledWith(1));
  });
});
