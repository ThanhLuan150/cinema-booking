import '@/i18n';
import i18n from '@/i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({
  getInSeatSession: vi.fn(),
  createInSeatOrder: vi.fn(),
  confirmInSeatMomoPayment: vi.fn(),
  getInSeatOrder: vi.fn(),
  getMyInSeatOrders: vi.fn(),
  getSeatQrSheet: vi.fn(),
}));
vi.mock('../api/inSeat.api', () => api);

import { SeatQrSheetModal } from './SeatQrSheetModal';

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SeatQrSheetModal scheduleId={7} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

describe('SeatQrSheetModal', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });
  beforeEach(() => {
    api.getSeatQrSheet.mockReset();
  });

  it('prints one QR per seat of the showtime, each opening the in-seat page for that seat', async () => {
    api.getSeatQrSheet.mockResolvedValue({
      showtime: {
        id: 7,
        date: '2026-10-03',
        time_begin: '19:30',
        time_end: '21:30',
        status: 'ACTIVE',
      },
      branch: { id: 1, name: 'CineNova Central' },
      room: { id: 5, name: 'Hall 3' },
      movie: { id: 1, name: 'Dune: Part Three' },
      seats: [
        { seat_code: 'E7', seat_type: 0, token: 'SQR1.e7.sig' },
        { seat_code: 'E8', seat_type: 0, token: 'SQR1.e8.sig' },
      ],
    });
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderModal();

    const cards = await screen.findAllByTestId('seat-qr-card');
    expect(api.getSeatQrSheet).toHaveBeenCalledWith(7);
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Seat E7')).toBeInTheDocument();
    expect(within(cards[0]).getByLabelText('QR code for seat E7')).toBeInTheDocument();
    expect(screen.getByText(/Dune: Part Three · CineNova Central · Hall 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Print/ }));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('shows the refusal when the caller may not print this showtime', async () => {
    api.getSeatQrSheet.mockRejectedValue({
      response: { status: 404, data: { code: 'SHOWTIME_NOT_FOUND' } },
    });
    renderModal();
    expect(await screen.findByText('Showtime not found.')).toBeInTheDocument();
  });
});
