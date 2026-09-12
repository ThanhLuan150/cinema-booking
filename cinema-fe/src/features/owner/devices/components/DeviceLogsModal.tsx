import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { Device } from '@/types/entities';
import { useCheckinLogs } from '../hooks/useCheckinLogs';

interface DeviceLogsModalProps {
  device: Device;
  onClose: () => void;
}

export function DeviceLogsModal({ device, onClose }: DeviceLogsModalProps) {
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
