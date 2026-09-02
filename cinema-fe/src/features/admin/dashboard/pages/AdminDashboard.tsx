import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { FinancialReport } from '@/features/reporting/components/FinancialReport';
function AdminDashboard() {
  const { t } = useTranslation('admin');

  return (
    <AdminLayout breadcrumb={t('dashboard.breadcrumb')}>
      <FinancialReport variant="system" />
    </AdminLayout>
  );
}

export default AdminDashboard;
