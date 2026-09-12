import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { Cinema } from '@/types/entities';
import { ALL_BRANCHES, TICKET_STATUSES } from '../constants';

interface ParkingToolbarProps {
  isAdmin: boolean;
  cinemas: Cinema[];
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  ticketStatus: string;
  onTicketStatusChange: (status: string) => void;
  canManage: boolean;
  showAreas: boolean;
  onToggleAreas: () => void;
  canOperate: boolean;
  concreteBranchId: number | undefined;
  onOpenEntry: () => void;
}

export function ParkingToolbar({
  isAdmin,
  cinemas,
  selectedBranchId,
  onBranchChange,
  ticketStatus,
  onTicketStatusChange,
  canManage,
  showAreas,
  onToggleAreas,
  canOperate,
  concreteBranchId,
  onOpenEntry,
}: ParkingToolbarProps) {
  const { t } = useTranslation('owner');

  const ticketStatusOptions = TICKET_STATUSES.map((s) => ({ label: t(`parking.ticketStatus.${s}`), value: s }));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="max-w-xs flex-1">
        <Select
          value={selectedBranchId}
          onChange={(e) => onBranchChange(e.target.value)}
          placeholder={t('parking.branchPlaceholder')}
          options={[
            ...(isAdmin ? [{ label: t('parking.allBranches'), value: ALL_BRANCHES }] : []),
            ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
          ]}
        />
      </div>
      <div className="max-w-xs flex-1">
        <Select
          value={ticketStatus}
          onChange={(e) => onTicketStatusChange(e.target.value)}
          placeholder={t('parking.statusFilterPlaceholder')}
          options={ticketStatusOptions}
        />
      </div>
      {canManage && (
        <Button type="button" variant="outline" onClick={onToggleAreas}>
          {t('parking.manageAreas')}
        </Button>
      )}
      {canOperate && concreteBranchId && (
        <Button type="button" variant="danger" onClick={onOpenEntry}>
          {t('parking.vehicleEntry')}
        </Button>
      )}
    </div>
  );
}
