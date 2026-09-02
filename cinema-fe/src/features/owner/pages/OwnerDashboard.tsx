import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Select } from '@/components/ui/Select';
import { FinancialReport } from '@/features/reporting/components/FinancialReport';
import { financialReportQueryKey } from '@/features/reporting/hooks/useFinancialReport';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useMyCinemas } from '../hooks/useMyCinemas';
import { setSelectedbranchId } from '../store/ownerDashboardSlice';

function OwnerDashboard() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const selectedbranchId = useAppSelector((state) => state.ownerDashboard.selectedbranchId);
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const cinemaOptions = useMemo(() => cinemas.map((c) => ({ label: c.name, value: c.id })), [cinemas]);

  const bookingVersion = useAppSelector((state) => state.realtime.ownerBookingVersion);
  useEffect(() => {
    if (bookingVersion > 0) queryClient.invalidateQueries({ queryKey: financialReportQueryKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingVersion]);

  return (
    <AdminLayout breadcrumb={t('dashboard.breadcrumb')}>
      <div className="mb-4 max-w-xs">
        <Select
          value={selectedbranchId}
          onChange={(e) => dispatch(setSelectedbranchId(e.target.value))}
          placeholder={t('dashboard.allMyCinemas')}
          options={cinemaOptions}
        />
      </div>

      <FinancialReport variant="branch" branchId={selectedbranchId} />
    </AdminLayout>
  );
}

export default OwnerDashboard;
