import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import type { Device, DeviceStatus, Entrance, EntranceStatus } from '@/types/entities';
import { useDevices } from '../hooks/useDevices';
import { useEntrances } from '../hooks/useEntrances';
import { useCheckinLogs } from '../hooks/useCheckinLogs';
import {
  useCreateDevice,
  useCreateEntrance,
  useDeleteDevice,
  useDeleteEntrance,
  useRotateDeviceKey,
  useUpdateDevice,
  useUpdateEntrance,
} from '../hooks/useDeviceMutations';

const ALL_BRANCHES = 'ALL';
const DEVICE_STATUSES: DeviceStatus[] = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
const ENTRANCE_STATUSES: EntranceStatus[] = ['ACTIVE', 'INACTIVE'];

const DEVICE_STATUS_VARIANT: Record<DeviceStatus, 'success' | 'default' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  MAINTENANCE: 'warning',
};

interface DeviceForm {
  device_id: string;
  name: string;
  entrance_id: string;
  status: DeviceStatus;
}

interface EntranceForm {
  name: string;
  code: string;
  status: EntranceStatus;
}

const emptyDeviceForm: DeviceForm = { device_id: '', name: '', entrance_id: '', status: 'ACTIVE' };
const emptyEntranceForm: EntranceForm = { name: '', code: '', status: 'ACTIVE' };

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

  const { data: devicesPage } = useDevices(
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

  const createDevice = useCreateDevice();
  const updateDevice = useUpdateDevice();
  const rotateKey = useRotateDeviceKey();
  const deleteDevice = useDeleteDevice();
  const createEntrance = useCreateEntrance();
  const updateEntrance = useUpdateEntrance();
  const deleteEntrance = useDeleteEntrance();

  // Modal state
  const [deviceModal, setDeviceModal] = useState<{ mode: 'create' | 'edit'; device?: Device } | null>(null);
  const [deviceForm, setDeviceForm] = useState<DeviceForm>(emptyDeviceForm);
  const [entranceModal, setEntranceModal] = useState<{ mode: 'create' | 'edit'; entrance?: Entrance } | null>(null);
  const [entranceForm, setEntranceForm] = useState<EntranceForm>(emptyEntranceForm);
  const [revealedKey, setRevealedKey] = useState<{ device_id: string; api_key: string } | null>(null);
  const [logsDevice, setLogsDevice] = useState<Device | null>(null);
  const [showEntrances, setShowEntrances] = useState(false);

  const canManage = hasPermission('device.create');
  const canManageEntrances = hasPermission('entrance.create');

  const openCreateDevice = useCallback(() => {
    setDeviceForm(emptyDeviceForm);
    setDeviceModal({ mode: 'create' });
  }, []);

  const openEditDevice = useCallback((device: Device) => {
    setDeviceForm({
      device_id: device.device_id,
      name: device.name,
      entrance_id: device.entrance_id ? String(device.entrance_id) : '',
      status: device.status,
    });
    setDeviceModal({ mode: 'edit', device });
  }, []);

  const submitDevice = useCallback(async () => {
    try {
      if (deviceModal?.mode === 'create') {
        if (!concreteBranchId) return;
        const created = await createDevice.mutateAsync({
          branch_id: concreteBranchId,
          device_id: deviceForm.device_id.trim(),
          name: deviceForm.name.trim(),
          entrance_id: deviceForm.entrance_id ? Number(deviceForm.entrance_id) : null,
          status: deviceForm.status,
        });
        setRevealedKey({ device_id: created.device_id, api_key: created.api_key });
        toast.success(t('devices.createSuccess'));
      } else if (deviceModal?.device) {
        await updateDevice.mutateAsync({
          id: deviceModal.device.id,
          name: deviceForm.name.trim(),
          entrance_id: deviceForm.entrance_id ? Number(deviceForm.entrance_id) : null,
          status: deviceForm.status,
        });
        toast.success(t('devices.updateSuccess'));
      }
      setDeviceModal(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  }, [deviceModal, deviceForm, concreteBranchId, createDevice, updateDevice, t]);

  const handleRotateKey = useCallback(
    async (device: Device) => {
      if (!(await confirmDialog(t('devices.rotateConfirm')))) return;
      try {
        const { api_key } = await rotateKey.mutateAsync(device.id);
        setRevealedKey({ device_id: device.device_id, api_key });
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [rotateKey, t],
  );

  const handleDeleteDevice = useCallback(
    async (device: Device) => {
      if (!(await confirmDialog(t('devices.deleteConfirm')))) return;
      try {
        await deleteDevice.mutateAsync(device.id);
        toast.success(t('devices.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteDevice, t],
  );

  const openCreateEntrance = useCallback(() => {
    setEntranceForm(emptyEntranceForm);
    setEntranceModal({ mode: 'create' });
  }, []);

  const openEditEntrance = useCallback((entrance: Entrance) => {
    setEntranceForm({ name: entrance.name, code: entrance.code, status: entrance.status });
    setEntranceModal({ mode: 'edit', entrance });
  }, []);

  const submitEntrance = useCallback(async () => {
    try {
      if (entranceModal?.mode === 'create') {
        if (!concreteBranchId) return;
        await createEntrance.mutateAsync({
          branch_id: concreteBranchId,
          name: entranceForm.name.trim(),
          code: entranceForm.code.trim() || undefined,
          status: entranceForm.status,
        });
        toast.success(t('devices.entranceCreateSuccess'));
      } else if (entranceModal?.entrance) {
        await updateEntrance.mutateAsync({
          id: entranceModal.entrance.id,
          name: entranceForm.name.trim(),
          code: entranceForm.code.trim(),
          status: entranceForm.status,
        });
        toast.success(t('devices.entranceUpdateSuccess'));
      }
      setEntranceModal(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  }, [entranceModal, entranceForm, concreteBranchId, createEntrance, updateEntrance, t]);

  const handleDeleteEntrance = useCallback(
    async (entrance: Entrance) => {
      if (!(await confirmDialog(t('devices.entranceDeleteConfirm')))) return;
      try {
        await deleteEntrance.mutateAsync(entrance.id);
        toast.success(t('devices.entranceDeleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteEntrance, t],
  );

  const statusOptions = DEVICE_STATUSES.map((s) => ({ label: t(`devices.status.${s}`), value: s }));
  const entranceOptions = [
    { label: t('devices.noEntrance'), value: '' },
    ...entrances.map((e) => ({ label: e.name, value: String(e.id) })),
  ];

  const formatLastSeen = (value: string | null) => (value ? new Date(value).toLocaleString() : t('devices.never'));

  return (
    <AdminLayout breadcrumb={t('devices.breadcrumb')}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Select
            value={selectedbranchId}
            onChange={(e) => {
              setSelectedbranchId(e.target.value);
              setPage(1);
            }}
            placeholder={t('devices.branchPlaceholder')}
            options={[
              ...(isAdmin ? [{ label: t('devices.allBranches'), value: ALL_BRANCHES }] : []),
              ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
            ]}
          />
        </div>
        <div className="max-w-xs flex-1">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder={t('devices.statusFilterPlaceholder')}
            options={statusOptions}
          />
        </div>
        {canManageEntrances && (
          <Button type="button" variant="outline" onClick={() => setShowEntrances((v) => !v)}>
            {t('devices.manageEntrances')}
          </Button>
        )}
        {canManage && concreteBranchId && (
          <Button type="button" variant="danger" onClick={openCreateDevice}>
            {t('devices.addButton')}
          </Button>
        )}
      </div>

      {showEntrances && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-txt/60">{t('devices.entrancesTitle')}</h3>
            {canManageEntrances && concreteBranchId && (
              <Button type="button" size="sm" variant="secondary" onClick={openCreateEntrance}>
                {t('devices.addEntranceButton')}
              </Button>
            )}
          </div>
          {entrances.length === 0 ? (
            <p className="text-sm text-txt/60">{t('devices.noEntrances')}</p>
          ) : (
            <DataTable
              headers={[
                t('devices.entranceHeaders.name'),
                t('devices.entranceHeaders.code'),
                t('devices.entranceHeaders.status'),
                t('devices.entranceHeaders.actions'),
              ]}
            >
              {entrances.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.code || '—'}</td>
                  <td>
                    <Badge variant={e.status === 'ACTIVE' ? 'success' : 'default'}>{t(`devices.entranceStatus.${e.status}`)}</Badge>
                  </td>
                  <td className="flex flex-wrap gap-3">
                    {canManageEntrances && (
                      <>
                        <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => openEditEntrance(e)}>
                          {t('devices.edit')}
                        </button>
                        <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => handleDeleteEntrance(e)}>
                          {t('devices.delete')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      )}

      <DataTable
        headers={[
          t('devices.headers.deviceId'),
          ...(isAllBranches ? [t('devices.headers.branch')] : []),
          t('devices.headers.name'),
          t('devices.headers.entrance'),
          t('devices.headers.status'),
          t('devices.headers.lastSeen'),
          t('devices.headers.actions'),
        ]}
      >
        {devices.map((d) => (
          <tr key={d.id}>
            <td className="font-mono text-xs">{d.device_id}</td>
            {isAllBranches && <td>{branchNameById.get(d.branch_id) || d.branch_id}</td>}
            <td>{d.name}</td>
            <td>{d.entrance_id ? entranceNameById.get(d.entrance_id) || `#${d.entrance_id}` : t('devices.noEntrance')}</td>
            <td>
              <Badge variant={DEVICE_STATUS_VARIANT[d.status]}>{t(`devices.status.${d.status}`)}</Badge>
            </td>
            <td className="text-sm text-txt/70">{formatLastSeen(d.last_seen_at)}</td>
            <td className="flex flex-wrap gap-3">
              <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => setLogsDevice(d)}>
                {t('devices.viewLogs')}
              </button>
              {canManage && (
                <>
                  <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => openEditDevice(d)}>
                    {t('devices.edit')}
                  </button>
                  <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => handleRotateKey(d)}>
                    {t('devices.rotateKey')}
                  </button>
                  <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => handleDeleteDevice(d)}>
                    {t('devices.delete')}
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={devicesPage?.totalPages ?? 1} onPageChange={setPage} />

      {deviceModal && (
        <Modal
          open
          onClose={() => setDeviceModal(null)}
          title={deviceModal.mode === 'create' ? t('devices.addTitle') : t('devices.editTitle')}
        >
          <div className="space-y-3">
            <Input
              id="device-form-device-id"
              label={t('devices.deviceIdLabel')}
              value={deviceForm.device_id}
              disabled={deviceModal.mode === 'edit'}
              onChange={(e) => setDeviceForm((f) => ({ ...f, device_id: e.target.value }))}
            />
            <Input
              id="device-form-name"
              label={t('devices.nameLabel')}
              value={deviceForm.name}
              onChange={(e) => setDeviceForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              label={t('devices.entranceLabel')}
              value={deviceForm.entrance_id}
              options={entranceOptions}
              onChange={(e) => setDeviceForm((f) => ({ ...f, entrance_id: e.target.value }))}
            />
            <Select
              label={t('devices.statusLabel')}
              value={deviceForm.status}
              options={DEVICE_STATUSES.map((s) => ({ label: t(`devices.status.${s}`), value: s }))}
              onChange={(e) => setDeviceForm((f) => ({ ...f, status: e.target.value as DeviceStatus }))}
            />
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="danger"
                loading={createDevice.isPending || updateDevice.isPending}
                disabled={!deviceForm.device_id.trim() || !deviceForm.name.trim()}
                onClick={submitDevice}
              >
                {t('devices.submit')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {entranceModal && (
        <Modal
          open
          onClose={() => setEntranceModal(null)}
          title={entranceModal.mode === 'create' ? t('devices.addEntranceTitle') : t('devices.editEntranceTitle')}
        >
          <div className="space-y-3">
            <Input
              id="entrance-form-name"
              label={t('devices.entranceNameLabel')}
              value={entranceForm.name}
              onChange={(e) => setEntranceForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              id="entrance-form-code"
              label={t('devices.entranceCodeLabel')}
              value={entranceForm.code}
              onChange={(e) => setEntranceForm((f) => ({ ...f, code: e.target.value }))}
            />
            <Select
              label={t('devices.statusLabel')}
              value={entranceForm.status}
              options={ENTRANCE_STATUSES.map((s) => ({ label: t(`devices.entranceStatus.${s}`), value: s }))}
              onChange={(e) => setEntranceForm((f) => ({ ...f, status: e.target.value as EntranceStatus }))}
            />
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="danger"
                loading={createEntrance.isPending || updateEntrance.isPending}
                disabled={!entranceForm.name.trim()}
                onClick={submitEntrance}
              >
                {t('devices.submit')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {revealedKey && (
        <Modal open onClose={() => setRevealedKey(null)} title={t('devices.keyTitle')}>
          <p className="text-sm text-txt/70">{t('devices.keyHint', { deviceId: revealedKey.device_id })}</p>
          <code className="mt-3 block break-all rounded-lg border border-border bg-surface p-3 font-mono text-sm text-accent">
            {revealedKey.api_key}
          </code>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setRevealedKey(null)}>
              {t('devices.keyDone')}
            </Button>
          </div>
        </Modal>
      )}

      {logsDevice && (
        <DeviceLogsModal device={logsDevice} onClose={() => setLogsDevice(null)} />
      )}
    </AdminLayout>
  );
}

interface DeviceLogsModalProps {
  device: Device;
  onClose: () => void;
}

function DeviceLogsModal({ device, onClose }: DeviceLogsModalProps) {
  const { t } = useTranslation('owner');
  const [page, setPage] = useState(1);
  const { data } = useCheckinLogs(device.branch_id, page, DEFAULT_PAGE_SIZE, { deviceId: device.id });
  const logs = data?.data ?? [];

  return (
    <Modal open onClose={onClose} title={t('devices.logsTitle', { name: device.name })} className="max-w-2xl">
      {logs.length === 0 ? (
        <p className="text-sm text-txt/60">{t('devices.noLogs')}</p>
      ) : (
        <DataTable
          headers={[t('devices.logHeaders.time'), t('devices.logHeaders.result'), t('devices.logHeaders.invoice'), t('devices.logHeaders.reason')]}
        >
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="text-sm">{new Date(log.checked_in_at).toLocaleString()}</td>
              <td>
                <Badge variant={log.result === 'SUCCESS' ? 'success' : 'warning'}>{t(`devices.result.${log.result}`)}</Badge>
              </td>
              <td>{log.invoice_id ? `#${log.invoice_id}` : '—'}</td>
              <td className="text-sm text-txt/70">{log.reason || '—'}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </Modal>
  );
}

export default DevicesList;
