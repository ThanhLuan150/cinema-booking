import { TICKET_STATUS } from '@/constants/ticketStatus';
import type { Seat } from '@/types/entities';
import type { BookedSeatTicket, SeatCell, SeatCellStatus } from '../types/booking.types';

// Shared by every seat picker (the regular booking grid and the group booking picker).
export function buildSeatCells(tickets: BookedSeatTicket[], roomSeats: Seat[]): SeatCell[] {
  const ticketBySeatCode = new Map(tickets.map((ticket) => [ticket.seat_code, ticket]));
  // Room seat map hasn't loaded yet (or the room has none on record) — fall back to laying out
  // purely from tickets so the grid still renders once schedule data arrives.
  const seatSlots =
    roomSeats.length > 0
      ? roomSeats.map((seat) => ({ seat_code: seat.seat_code, seat_type: seat.seat_type, isDisabled: seat.status === 'DISABLED' }))
      : tickets.map((ticket) => ({ seat_code: ticket.seat_code, seat_type: ticket.seat_type, isDisabled: false }));

  const cells: SeatCell[] = [];
  for (const seat of seatSlots) {
    if (seat.isDisabled) {
      cells.push({ seatCode: seat.seat_code, seatType: seat.seat_type, status: 'DISABLED', ticket: null });
      continue;
    }
    const ticket = ticketBySeatCode.get(seat.seat_code);
    if (!ticket) continue;
    const status: SeatCellStatus =
      ticket.status === TICKET_STATUS.sold ? 'BOOKED' : ticket.status === TICKET_STATUS.held ? 'HELD' : 'AVAILABLE';
    cells.push({ seatCode: seat.seat_code, seatType: ticket.seat_type, status, ticket });
  }
  return cells;
}

/** Row letter -> that row's cells, left to right (A2 before A10). */
export function groupSeatRows(cells: SeatCell[]): Record<string, SeatCell[]> {
  const rows: Record<string, SeatCell[]> = {};
  for (const cell of cells) {
    const match = cell.seatCode.match(/^([A-Za-z]+)(\d+)$/);
    if (!match) continue;
    const rowLetter = match[1];
    if (!rows[rowLetter]) rows[rowLetter] = [];
    rows[rowLetter].push(cell);
  }
  for (const rowLetter of Object.keys(rows)) {
    rows[rowLetter].sort(
      (a, b) =>
        Number(a.seatCode.slice(rowLetter.length)) - Number(b.seatCode.slice(rowLetter.length)),
    );
  }
  return rows;
}
