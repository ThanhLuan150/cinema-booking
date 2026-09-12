import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import type { ParkingTicketStatus } from '@/types/entities';
import { useParkingAreas } from '../hooks/useParkingAreas';
import { useParkingSlots } from '../hooks/useParkingSlots';
import { useParkingTickets } from '../hooks/useParkingTickets';
import { ALL_BRANCHES } from '../constants';
import { ParkingToolbar } from '../components/ParkingToolbar';
import { AreasPanel } from '../components/AreasPanel';
import { TicketsTable } from '../components/TicketsTable';
import { EntryFormModal } from '../components/EntryFormModal';

function ParkingList() {
  const { t } = useTranslation('owner');
  const isAdmin = useAuthRole() === ROLES.admin;
  const { hasPermission } = usePermissions();

  const [ticketPage, setTicketPage] = useState(1);
  const [ticketStatus, setTicketStatus] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');

  const { data: currentUser } = useCurrentUser();
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const isAllBranches = selectedBranchId === ALL_BRANCHES;
  const concreteBranchId = !isAllBranches && selectedBranchId ? Number(selectedBranchId) : undefined;

  useEffect(() => {
    if (selectedBranchId) return;
    if (isAdmin) setSelectedBranchId(ALL_BRANCHES);
    else if (currentUser?.cinema_id) setSelectedBranchId(String(currentUser.cinema_id));
    else if (cinemas.length > 0) setSelectedBranchId(String(cinemas[0].id));
  }, [cinemas, selectedBranchId, isAdmin, currentUser]);

  const branchParam = isAllBranches ? undefined : selectedBranchId || undefined;
  const listEnabled = Boolean(selectedBranchId);

  const { data: areasPage } = useParkingAreas(branchParam, 1, FULL_LIST_FETCH_LIMIT, undefined, { enabled: listEnabled });
  const areas = useMemo(() => areasPage?.data ?? [], [areasPage]);
  const areaNameById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);

  const { data: ticketsPage, isLoading } = useParkingTickets(
    branchParam,
    ticketPage,
    DEFAULT_PAGE_SIZE,
    { status: (ticketStatus || undefined) as ParkingTicketStatus | undefined },
    { enabled: listEnabled },
  );
  const tickets = useMemo(() => ticketsPage?.data ?? [], [ticketsPage]);

  // Free slots for the current branch, used to populate the "pick a slot" dropdown on entry.
  const { data: freeSlotsPage } = useParkingSlots(
    undefined,
    1,
    FULL_LIST_FETCH_LIMIT,
    { branchId: branchParam, status: 'AVAILABLE' },
    { enabled: listEnabled && !isAllBranches },
  );
  const freeSlots = useMemo(() => freeSlotsPage?.data ?? [], [freeSlotsPage]);

  const [entryOpen, setEntryOpen] = useState(false);
  const [showAreas, setShowAreas] = useState(false);

  const canManage = hasPermission('parking.manage');
  const canOperate = hasPermission('parking.operate');

  return (
    <AdminLayout breadcrumb={t('parking.breadcrumb')} loading={isLoading}>
      <ParkingToolbar
        isAdmin={isAdmin}
        cinemas={cinemas}
        selectedBranchId={selectedBranchId}
        onBranchChange={(branchId) => {
          setSelectedBranchId(branchId);
          setTicketPage(1);
        }}
        ticketStatus={ticketStatus}
        onTicketStatusChange={(status) => {
          setTicketStatus(status);
          setTicketPage(1);
        }}
        canManage={canManage}
        showAreas={showAreas}
        onToggleAreas={() => setShowAreas((v) => !v)}
        canOperate={canOperate}
        concreteBranchId={concreteBranchId}
        onOpenEntry={() => setEntryOpen(true)}
      />

      {showAreas && <AreasPanel areas={areas} canManage={canManage} concreteBranchId={concreteBranchId} />}

      <TicketsTable
        tickets={tickets}
        isAllBranches={isAllBranches}
        canOperate={canOperate}
        page={ticketPage}
        totalPages={ticketsPage?.totalPages ?? 1}
        onPageChange={setTicketPage}
      />

      {entryOpen && (
        <EntryFormModal
          branchId={concreteBranchId}
          freeSlots={freeSlots}
          areaNameById={areaNameById}
          onClose={() => setEntryOpen(false)}
        />
      )}
    </AdminLayout>
  );
}

export default ParkingList;
