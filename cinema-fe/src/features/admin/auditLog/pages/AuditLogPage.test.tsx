import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import { ROLES } from '@/constants/roles';

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

let role: number = ROLES.owner;
vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuthRole: () => role }));
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: { cinema_id: 1 } }) }));
vi.mock('@/features/owner/hooks/useMyCinemas', () => ({
  useMyCinemas: () => ({ data: { data: [{ id: 1, name: 'Branch A' }, { id: 2, name: 'Branch B' }] } }),
}));

vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useAuditLogsMock = vi.fn();
const useAuditLogMetaMock = vi.fn();
vi.mock('../hooks/useAuditLogs', () => ({
  useAuditLogs: (...a: unknown[]) => useAuditLogsMock(...a),
  useAuditLogMeta: (...a: unknown[]) => useAuditLogMetaMock(...a),
}));

import AuditLogPage from './AuditLogPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuditLogPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    entity_type: 'BRANCH',
    entity_id: 7,
    action: 'CREATE_BRANCH',
    performed_by: 42,
    user_id: 42,
    branch_id: 1,
    reason: null,
    metadata: { name: 'Branch A' },
    createdAt: '2026-08-27T10:00:00.000Z',
    ...overrides,
  };
}

describe('AuditLogPage', () => {
  beforeEach(() => {
    role = ROLES.owner;
    useAuditLogsMock.mockReset().mockReturnValue({ data: { data: [row()], totalPages: 1 }, isLoading: false });
    useAuditLogMetaMock
      .mockReset()
      .mockReturnValue({ data: { actions: ['CREATE_BRANCH', 'CANCEL_BOOKING'], entityTypes: ['BRANCH', 'BOOKING'] } });
  });

  it('renders an audit row', () => {
    renderPage();
    expect(screen.getByText('auditLog.actions.CREATE_BRANCH')).toBeInTheDocument();
    expect(screen.getByText(/#7/)).toBeInTheDocument();
  });

  it('as owner scopes the query to the owner\'s own branch', () => {
    renderPage();
    expect(useAuditLogsMock).toHaveBeenLastCalledWith(
      1,
      expect.any(Number),
      expect.objectContaining({ branchId: '1' }),
    );
  });

  it('selecting an action from the dropdown passes it to the hook', () => {
    renderPage();
    // open the action combobox (its placeholder is shown until a value is picked)
    const anyButtons = screen.getAllByText('auditLog.filters.any');
    fireEvent.click(anyButtons[anyButtons.length - 1]);
    fireEvent.click(screen.getByText('auditLog.actions.CANCEL_BOOKING'));
    expect(useAuditLogsMock).toHaveBeenLastCalledWith(
      1,
      expect.any(Number),
      expect.objectContaining({ action: 'CANCEL_BOOKING' }),
    );
  });

  it('opens the detail modal with metadata', () => {
    renderPage();
    fireEvent.click(screen.getByText('auditLog.view'));
    expect(screen.getByText(/"name": "Branch A"/)).toBeInTheDocument();
  });

  it('as owner does not show the all-branches option', () => {
    renderPage();
    expect(screen.queryByText('auditLog.filters.allBranches')).not.toBeInTheDocument();
  });

  it('as admin defaults to all-branches and shows the branch column', () => {
    role = ROLES.admin;
    renderPage();
    expect(screen.getByText('auditLog.filters.allBranches')).toBeInTheDocument();
    expect(screen.getByText('auditLog.headers.branch')).toBeInTheDocument();
  });
});
