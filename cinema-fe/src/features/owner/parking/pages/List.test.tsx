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
  useMyCinemas: () => ({ data: { data: [{ id: 1, name: 'Branch A' }] } }),
}));

const hasPermissionMock = vi.fn();
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: hasPermissionMock }) }));

const useParkingAreasMock = vi.fn();
const useParkingSlotsMock = vi.fn();
const useParkingTicketsMock = vi.fn();
vi.mock('../hooks/useParkingAreas', () => ({ useParkingAreas: (...a: unknown[]) => useParkingAreasMock(...a) }));
vi.mock('../hooks/useParkingSlots', () => ({ useParkingSlots: (...a: unknown[]) => useParkingSlotsMock(...a) }));
vi.mock('../hooks/useParkingTickets', () => ({ useParkingTickets: (...a: unknown[]) => useParkingTicketsMock(...a) }));

const enterVehicle = vi.fn();
const exitVehicle = vi.fn();
const payTicket = vi.fn();
const cancelTicket = vi.fn();
const createArea = vi.fn();
const updateArea = vi.fn();
const deleteArea = vi.fn();
vi.mock('../hooks/useParkingMutations', () => ({
  useCreateParkingArea: () => ({ mutateAsync: createArea, isPending: false }),
  useUpdateParkingArea: () => ({ mutateAsync: updateArea, isPending: false }),
  useDeleteParkingArea: () => ({ mutateAsync: deleteArea, isPending: false }),
  useCreateParkingSlot: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateParkingSlot: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteParkingSlot: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEnterVehicle: () => ({ mutateAsync: enterVehicle, isPending: false }),
  useExitVehicle: () => ({ mutateAsync: exitVehicle, isPending: false }),
  usePayParkingTicket: () => ({ mutateAsync: payTicket, isPending: false }),
  useCancelParkingTicket: () => ({ mutateAsync: cancelTicket, isPending: false }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...a: unknown[]) => confirmDialogMock(...a) }));
vi.mock('@/features/notifications/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ParkingList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ParkingList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ticket_code: 'PK-ABC123',
    branch_id: 1,
    slot_id: 5,
    vehicle_type: 'CAR',
    vehicle_plate: '51F-123.45',
    entry_at: new Date().toISOString(),
    exit_at: null,
    status: 'ACTIVE',
    fee: 0,
    paid_at: null,
    ...overrides,
  };
}

describe('ParkingList', () => {
  beforeEach(() => {
    role = ROLES.owner;
    hasPermissionMock.mockReset().mockReturnValue(true);
    useParkingAreasMock.mockReset().mockReturnValue({ data: { data: [], totalPages: 1 } });
    useParkingSlotsMock.mockReset().mockReturnValue({ data: { data: [], totalPages: 1 } });
    useParkingTicketsMock.mockReset().mockReturnValue({ data: { data: [ticketRow()], totalPages: 1 }, isLoading: false });
    [enterVehicle, exitVehicle, payTicket, cancelTicket, createArea, updateArea, deleteArea, confirmDialogMock].forEach((m) => m.mockReset());
  });

  it('renders a parking ticket row', () => {
    renderPage();
    expect(screen.getByText('PK-ABC123')).toBeInTheDocument();
    expect(screen.getByText('51F-123.45')).toBeInTheDocument();
  });

  it('admits a vehicle on the picked branch', async () => {
    enterVehicle.mockResolvedValue({ id: 2 });
    renderPage();
    fireEvent.click(screen.getByText('parking.vehicleEntry'));
    fireEvent.change(screen.getByLabelText('parking.plateLabel'), { target: { value: '99a-000.11' } });
    fireEvent.click(screen.getByText('parking.admit'));
    await vi.waitFor(() =>
      expect(enterVehicle).toHaveBeenCalledWith(
        expect.objectContaining({ branch_id: 1, vehicle_type: 'CAR', vehicle_plate: '99a-000.11', slot_id: null }),
      ),
    );
  });

  it('registers an exit for an ACTIVE ticket', async () => {
    exitVehicle.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('parking.exit'));
    await vi.waitFor(() => expect(exitVehicle).toHaveBeenCalledWith(1));
  });

  it('takes payment for a PENDING_PAYMENT ticket', async () => {
    useParkingTicketsMock.mockReturnValue({
      data: { data: [ticketRow({ status: 'PENDING_PAYMENT', exit_at: new Date().toISOString(), fee: 50000 })], totalPages: 1 },
      isLoading: false,
    });
    payTicket.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('parking.takePayment'));
    await vi.waitFor(() => expect(payTicket).toHaveBeenCalledWith(1));
  });

  it('cancels an ACTIVE ticket after confirmation', async () => {
    confirmDialogMock.mockResolvedValue(true);
    cancelTicket.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('parking.cancel'));
    await vi.waitFor(() => expect(cancelTicket).toHaveBeenCalledWith(1));
  });

  it('hides operate actions without parking.operate', () => {
    hasPermissionMock.mockReturnValue(false);
    renderPage();
    expect(screen.queryByText('parking.vehicleEntry')).not.toBeInTheDocument();
    expect(screen.queryByText('parking.exit')).not.toBeInTheDocument();
  });
});
