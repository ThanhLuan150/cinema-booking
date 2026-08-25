import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';

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
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: { role: 3 } }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

// The camera scanner needs getUserMedia/canvas support the test DOM doesn't provide; it's
// covered on its own in QrScanner.test.tsx, so CheckIn only has to verify it's wired up.
const qrScannerOnScan = vi.fn();
vi.mock('../components/QrScanner', () => ({
  QrScanner: ({ active, onScan }: { active: boolean; onScan: (data: string) => void }) => {
    qrScannerOnScan.mockImplementation(onScan);
    return active ? <div data-testid="qr-scanner-stub" /> : null;
  },
}));

const refetchMock = vi.fn();
const useLookupInvoiceForCheckInMock = vi.fn();
const checkInMutate = vi.fn();
const verifyQrMutate = vi.fn();
vi.mock('../hooks/useInvoiceCheckIn', () => ({
  useLookupInvoiceForCheckIn: (...args: unknown[]) => useLookupInvoiceForCheckInMock(...args),
  useCheckInInvoice: () => ({ mutateAsync: checkInMutate, isPending: false }),
  useVerifyTicketByQr: () => ({ mutateAsync: verifyQrMutate, isPending: false }),
}));

import CheckIn from './CheckIn';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { placeholder: () => ({}) } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CheckIn />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('CheckIn', () => {
  beforeEach(() => {
    refetchMock.mockReset();
    useLookupInvoiceForCheckInMock.mockReset();
    checkInMutate.mockReset();
    verifyQrMutate.mockReset();
    qrScannerOnScan.mockReset();
    useLookupInvoiceForCheckInMock.mockReturnValue({ data: undefined, refetch: refetchMock, isFetching: false, error: null });
  });

  it('looks up an invoice by code', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('checkIn.codePlaceholder'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('checkIn.lookup'));
    expect(refetchMock).toHaveBeenCalled();
  });

  it('shows an error when the invoice is not found', () => {
    useLookupInvoiceForCheckInMock.mockReturnValue({
      data: undefined,
      refetch: refetchMock,
      isFetching: false,
      error: new Error('not found'),
    });
    renderPage();
    expect(screen.getByText('checkIn.notFound')).toBeInTheDocument();
  });

  it('shows the invoice detail and allows checking in a paid, not-yet-checked-in booking', async () => {
    useLookupInvoiceForCheckInMock.mockReturnValue({
      data: {
        id: 1,
        code: 'ABC',
        status: 1,
        checked_in: false,
        total_price: 100000,
        movie: { name: 'Movie A' },
        cinema: { name: 'Cinema A' },
        schedule: { movie_date: '2026-01-01', time_begin: '10:00' },
        ticket: { seat_code: 'A1', seat_type: 0, status: 0 },
      },
      refetch: refetchMock,
      isFetching: false,
      error: null,
    });
    checkInMutate.mockResolvedValue({});
    renderPage();

    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('checkIn.statusPaid')).toBeInTheDocument();

    fireEvent.click(screen.getByText('checkIn.confirmCheckIn'));
    await waitFor(() => expect(checkInMutate).toHaveBeenCalledWith(1));
  });

  it('disables check-in for an already checked-in booking', () => {
    useLookupInvoiceForCheckInMock.mockReturnValue({
      data: {
        id: 1,
        code: 'ABC',
        status: 1,
        checked_in: true,
        total_price: 100000,
        ticket: { seat_code: 'A1', seat_type: 0, status: 0 },
      },
      refetch: refetchMock,
      isFetching: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('checkIn.statusCheckedIn')).toBeInTheDocument();
    expect(screen.getByText('checkIn.confirmCheckIn')).toBeDisabled();
  });

  it('verifies a scanned ticket QR code and allows checking it in', async () => {
    verifyQrMutate.mockResolvedValue({
      ticket_id: 5,
      status: 'ISSUED',
      seat_code: 'B3',
      movie: { name: 'Movie B' },
      branch: { name: 'Cinema B' },
      schedule: { movie_date: '2026-01-01', time_begin: '18:00' },
    });
    checkInMutate.mockResolvedValue({});
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('checkIn.qrPlaceholder'), { target: { value: 'TCK-1' } });
    fireEvent.click(screen.getByText('checkIn.qrVerify'));
    await waitFor(() => expect(verifyQrMutate).toHaveBeenCalledWith('TCK-1'));

    expect(await screen.findByText('Movie B')).toBeInTheDocument();
    expect(screen.getByText('checkIn.statusIssued')).toBeInTheDocument();

    fireEvent.click(screen.getByText('checkIn.confirmCheckIn'));
    await waitFor(() => expect(checkInMutate).toHaveBeenCalledWith(5));
  });

  it('submits the QR lookup on Enter, mimicking a hardware scanner', async () => {
    verifyQrMutate.mockResolvedValue({ ticket_id: 5, status: 'ISSUED', seat_code: 'B3', schedule: {} });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('checkIn.qrPlaceholder'), { target: { value: 'TCK-2' } });
    fireEvent.keyDown(screen.getByPlaceholderText('checkIn.qrPlaceholder'), { key: 'Enter' });
    await waitFor(() => expect(verifyQrMutate).toHaveBeenCalledWith('TCK-2'));
  });

  it('shows an error and no ticket card for an unknown QR code', async () => {
    verifyQrMutate.mockRejectedValue(new Error('not found'));
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('checkIn.qrPlaceholder'), { target: { value: 'TCK-bad' } });
    fireEvent.click(screen.getByText('checkIn.qrVerify'));
    expect(await screen.findByText('checkIn.qrNotFound')).toBeInTheDocument();
  });

  it('toggles the camera scanner on and off', () => {
    renderPage();
    expect(screen.queryByTestId('qr-scanner-stub')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('checkIn.startScan'));
    expect(screen.getByTestId('qr-scanner-stub')).toBeInTheDocument();
    expect(screen.getByText('checkIn.stopScan')).toBeInTheDocument();

    fireEvent.click(screen.getByText('checkIn.stopScan'));
    expect(screen.queryByTestId('qr-scanner-stub')).not.toBeInTheDocument();
  });

  it('verifies and offers check-in for a ticket detected by the camera scanner', async () => {
    verifyQrMutate.mockResolvedValue({
      ticket_id: 5,
      status: 'ISSUED',
      seat_code: 'B3',
      movie: { name: 'Movie B' },
      schedule: {},
    });
    renderPage();

    fireEvent.click(screen.getByText('checkIn.startScan'));
    qrScannerOnScan('TCK-CAM');

    await waitFor(() => expect(verifyQrMutate).toHaveBeenCalledWith('TCK-CAM'));
    expect(await screen.findByText('Movie B')).toBeInTheDocument();
    expect(screen.queryByTestId('qr-scanner-stub')).not.toBeInTheDocument();
  });

  it('disables QR check-in for a ticket that is not ISSUED (e.g. already USED)', async () => {
    verifyQrMutate.mockResolvedValue({ ticket_id: 5, status: 'USED', seat_code: 'B3', schedule: {} });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('checkIn.qrPlaceholder'), { target: { value: 'TCK-1' } });
    fireEvent.click(screen.getByText('checkIn.qrVerify'));
    expect(await screen.findByText('checkIn.statusUsed')).toBeInTheDocument();
    expect(screen.getByText('checkIn.confirmCheckIn')).toBeDisabled();
  });
});
