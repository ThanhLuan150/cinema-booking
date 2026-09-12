import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ParkingTicket } from '@/types/entities';
import { TICKET_STATUS_VARIANT } from '../constants';
import { useCancelParkingTicket, useExitVehicle, usePayParkingTicket } from '../hooks/useParkingMutations';

const fmtMoney = (n: number) => new Intl.NumberFormat().format(n);
const fmtTime = (v: string | null) => (v ? new Date(v).toLocaleString() : '—');

interface TicketsTableProps {
  tickets: ParkingTicket[];
  isAllBranches: boolean;
  canOperate: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function TicketsTable({ tickets, isAllBranches, canOperate, page, totalPages, onPageChange }: TicketsTableProps) {
  const { t } = useTranslation('owner');

  const exitVehicle = useExitVehicle();
  const payTicket = usePayParkingTicket();
  const cancelTicket = useCancelParkingTicket();

  const runTicketAction = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleExit = (ticket: ParkingTicket) => runTicketAction(t('parking.exitSuccess'), () => exitVehicle.mutateAsync(ticket.id));
  const handlePay = (ticket: ParkingTicket) => runTicketAction(t('parking.paySuccess'), () => payTicket.mutateAsync(ticket.id));
  const handleCancel = async (ticket: ParkingTicket) => {
    if (!(await confirmDialog(t('parking.cancelConfirm')))) return;
    runTicketAction(t('parking.cancelSuccess'), () => cancelTicket.mutateAsync(ticket.id));
  };

  return (
    <>
      <DataTable
        headers={[
          t('parking.ticketHeaders.code'),
          ...(isAllBranches ? [t('parking.ticketHeaders.branch')] : []),
          t('parking.ticketHeaders.plate'),
          t('parking.ticketHeaders.vehicleType'),
          t('parking.ticketHeaders.slot'),
          t('parking.ticketHeaders.entry'),
          t('parking.ticketHeaders.exit'),
          t('parking.ticketHeaders.fee'),
          t('parking.ticketHeaders.status'),
          t('parking.ticketHeaders.actions'),
        ]}
      >
        {tickets.map((tk) => (
          <tr key={tk.id}>
            <td className="font-mono text-xs">{tk.ticket_code}</td>
            {isAllBranches && <td>{tk.branch_id}</td>}
            <td className="font-mono text-xs">{tk.vehicle_plate}</td>
            <td>{t(`parking.vehicleType.${tk.vehicle_type}`)}</td>
            <td>#{tk.slot_id}</td>
            <td className="text-sm text-txt/70">{fmtTime(tk.entry_at)}</td>
            <td className="text-sm text-txt/70">{fmtTime(tk.exit_at)}</td>
            <td>{tk.fee ? fmtMoney(tk.fee) : '—'}</td>
            <td>
              <Badge variant={TICKET_STATUS_VARIANT[tk.status]}>{t(`parking.ticketStatus.${tk.status}`)}</Badge>
            </td>
            <td className="flex flex-wrap gap-3">
              {canOperate && tk.status === 'ACTIVE' && (
                <>
                  <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => handleExit(tk)}>
                    {t('parking.exit')}
                  </button>
                  <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => handleCancel(tk)}>
                    {t('parking.cancel')}
                  </button>
                </>
              )}
              {canOperate && tk.status === 'PENDING_PAYMENT' && (
                <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => handlePay(tk)}>
                  {t('parking.takePayment')}
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
}
