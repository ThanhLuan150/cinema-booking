import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => (opts?.id !== undefined ? `${key}:${opts.id}` : key),
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: { role: 3 } }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMyShiftAssignmentsMock = vi.fn();
vi.mock('../hooks/useMyShiftAssignments', () => ({
  useMyShiftAssignments: (...args: unknown[]) => useMyShiftAssignmentsMock(...args),
}));

import MySchedule from './MySchedule';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { placeholder: () => ({}) } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MySchedule />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('MySchedule', () => {
  beforeEach(() => {
    useMyShiftAssignmentsMock.mockReset();
  });

  it('shows an empty state when there are no assignments', () => {
    useMyShiftAssignmentsMock.mockReturnValue({ data: { data: [] } });
    renderPage();
    expect(screen.getByText('mySchedule.emptyTitle')).toBeInTheDocument();
  });

  it('lists the assignment rows with date, formatted times and status', () => {
    useMyShiftAssignmentsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_id: 1,
            shift_id: 5,
            branch_id: 1,
            date: '2026-08-12',
            start_at: '2026-08-12T08:00:00',
            end_at: '2026-08-12T16:00:00',
            status: 'ACTIVE',
          },
        ],
      },
    });
    renderPage();
    expect(screen.getByText('mySchedule.shiftLabel:5')).toBeInTheDocument();
    expect(screen.getByText('2026-08-12')).toBeInTheDocument();
    expect(screen.getByText('08:00 - 16:00')).toBeInTheDocument();
    expect(screen.getByText('mySchedule.statusActive')).toBeInTheDocument();
  });
});
