import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { getApiErrorMessage } from '@/lib/apiError';
import { useCustomerCrmProfile } from '../hooks/useCustomerCrmProfile';
import { CustomerProfileCard } from './CustomerProfileCard';

export interface CustomerCrmModalProps {
  accountId: number | null;
  customerName?: string;
  onClose: () => void;
}

/** Admin/staff drawer: one customer's aggregated CRM profile, opened from a users list. */
export function CustomerCrmModal({ accountId, customerName, onClose }: CustomerCrmModalProps) {
  const { t } = useTranslation('crm');
  const { data: profile, isLoading, error } = useCustomerCrmProfile(accountId);

  return (
    <Modal open={accountId != null} onClose={onClose} title={customerName || t('modalTitle')}>
      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}
      {error && !isLoading && (
        <EmptyState title={getApiErrorMessage(error, t)} icon="fa-solid fa-triangle-exclamation" />
      )}
      {profile && !isLoading && <CustomerProfileCard profile={profile} variant="staff" />}
    </Modal>
  );
}
