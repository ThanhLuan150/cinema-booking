import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import type { Device, DeviceStatus } from '@/types/entities';
import { useDevices } from '../hooks/useDevices';
import { useEntrances } from '../hooks/useEntrances';
import { ALL_BRANCHES } from '../constants';
import { DevicesToolbar } from '../components/DevicesToolbar';
import { EntrancesPanel } from '../components/EntrancesPanel';
import { DevicesTable } from '../components/DevicesTable';

function DevicesList() {
  const { t } = useTranslation('owner');
  const isAdmin = useAuthRole() === ROLES.admin;
  const { hasPermission } = usePermissions();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedbranchId, setSelectedbranchId] = useState('');

  const { data: currentUser } = useCurrentUser();
  // Super Admin's /cinema/mine returns every branch, so both roles get a usable branch picker.
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const branchNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);
  const isAllBranches = selectedbranchId === ALL_BRANCHES;
  const concreteBranchId = !isAllBranches && selectedbranchId ? Number(selectedbranchId) : undefined;

  useEffect(() => {
    if (selectedbranchId) return;
    if (isAdmin) setSelectedbranchId(ALL_BRANCHES);
    else if (currentUser?.cinema_id) setSelectedbranchId(String(currentUser.cinema_id));
    else if (cinemas.length > 0) setSelectedbranchId(String(cinemas[0].id));
  }, [cinemas, selectedbranchId, isAdmin, currentUser]);

  const branchParam = isAllBranches ? undefined : selectedbranchId || undefined;
  const listEnabled = Boolean(selectedbranchId);

  const { data: devicesPage, isLoading } = useDevices(
    branchParam,
    page,
    DEFAULT_PAGE_SIZE,
    { status: (statusFilter || undefined) as DeviceStatus | undefined },
    { enabled: listEnabled },
  );
  const devices = useMemo(() => devicesPage?.data ?? [], [devicesPage]);

  const { data: entrancesPage } = useEntrances(branchParam, 1, FULL_LIST_FETCH_LIMIT, undefined, { enabled: listEnabled });
  const entrances = useMemo(() => entrancesPage?.data ?? [], [entrancesPage]);
  const entranceNameById = useMemo(() => new Map(entrances.map((e) => [e.id, e.name])), [entrances]);

  const [deviceModal, setDeviceModal] = useState<{ mode: 'create' | 'edit'; device?: Device } | null>(null);
  const [showEntrances, setShowEntrances] = useState(false);

  const canManage = hasPermission('device.create');
  const canManageEntrances = hasPermission('entrance.create');

  const openCreateDevice = useCallback(() => setDeviceModal({ mode: 'create' }), []);
  const openEditDevice = useCallback((device: Device) => setDeviceModal({ mode: 'edit', device }), []);

  return (
    <AdminLayout breadcrumb={t('devices.breadcrumb')} loading={isLoading}>
      <DevicesToolbar
        isAdmin={isAdmin}
        cinemas={cinemas}
        selectedBranchId={selectedbranchId}
        onBranchChange={(branchId) => {
          setSelectedbranchId(branchId);
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        canManageEntrances={canManageEntrances}
        showEntrances={showEntrances}
        onToggleEntrances={() => setShowEntrances((v) => !v)}
        canManage={canManage}
        concreteBranchId={concreteBranchId}
        onOpenCreateDevice={openCreateDevice}
      />

      {showEntrances && (
        <EntrancesPanel entrances={entrances} canManageEntrances={canManageEntrances} concreteBranchId={concreteBranchId} />
      )}

      <DevicesTable
        devices={devices}
        entrances={entrances}
        entranceNameById={entranceNameById}
        branchNameById={branchNameById}
        isAllBranches={isAllBranches}
        canManage={canManage}
        concreteBranchId={concreteBranchId}
        page={page}
        totalPages={devicesPage?.totalPages ?? 1}
        onPageChange={setPage}
        deviceModal={deviceModal}
        onOpenEditDevice={openEditDevice}
        onCloseDeviceModal={() => setDeviceModal(null)}
      />
    </AdminLayout>
  );
}

export default DevicesList;
