import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useAppSelector } from '@/hooks/redux';
import { myCinemasQueryKey, useMyCinemas } from '../../hooks/useMyCinemas';
import { CinemaTable } from '../components/CinemaTable';

function CinemaList() {
  const { t } = useTranslation('owner');
  const queryClient = useQueryClient();
  const { data: cinemasPage, isLoading } = useMyCinemas();
  const cinemas = cinemasPage?.data ?? [];

  const statusVersion = useAppSelector((state) => state.realtime.cinemaStatusVersion);
  useEffect(() => {
    if (statusVersion > 0) queryClient.invalidateQueries({ queryKey: myCinemasQueryKey });
  }, [statusVersion, queryClient]);

  return (
    <AdminLayout breadcrumb={t('cinemas.breadcrumb')} loading={isLoading}>
      <CinemaTable cinemas={cinemas} />
    </AdminLayout>
  );
}

export default CinemaList;
