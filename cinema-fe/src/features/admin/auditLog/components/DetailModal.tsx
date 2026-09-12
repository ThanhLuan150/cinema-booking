import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import type { AuditLog } from '@/types/entities';

export interface DetailModalProps {
  detail: AuditLog | null;
  onClose: () => void;
  branchNameById: Map<number, string>;
}

export const DetailModal = ({ detail, onClose, branchNameById }: DetailModalProps) => {
  const { t } = useTranslation('owner');

  if (!detail) return null;

  return (
    <Modal open onClose={onClose} title={t('auditLog.detailTitle', { id: detail.id })} className="max-w-lg">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-txt/60">{t('auditLog.headers.action')}</dt>
          <dd className="font-medium">{detail.action}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-txt/60">{t('auditLog.headers.entity')}</dt>
          <dd>{detail.entity_type} #{detail.entity_id}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-txt/60">{t('auditLog.headers.actor')}</dt>
          <dd>{detail.performed_by ? `#${detail.performed_by}` : t('auditLog.systemActor')}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-txt/60">{t('auditLog.headers.branch')}</dt>
          <dd>{detail.branch_id ? branchNameById.get(detail.branch_id) || `#${detail.branch_id}` : t('auditLog.system')}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-txt/60">{t('auditLog.headers.time')}</dt>
          <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
        </div>
        {detail.reason && (
          <div className="flex justify-between gap-4">
            <dt className="text-txt/60">{t('auditLog.reason')}</dt>
            <dd className="text-right">{detail.reason}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-txt/50">{t('auditLog.metadata')}</p>
        <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-surface p-3 text-xs">
          {JSON.stringify(detail.metadata ?? {}, null, 2)}
        </pre>
      </div>
    </Modal>
  );
};
