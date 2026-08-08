import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { useAppSelector } from '@/hooks/redux';
import { myCinemasQueryKey, useMyCinemas } from '../../hooks/useMyCinemas';
import { CINEMA_STATUS, CINEMA_STATUS_META } from '@/constants/cinemaStatus';
import { ROUTES } from '@/constants/routes';

function CinemaList() {
  const { t } = useTranslation('owner');
  const queryClient = useQueryClient();
  const STATUS_LABEL = t('cinemas.statusLabels', { returnObjects: true }) as unknown as string[];
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = cinemasPage?.data ?? [];

  const statusVersion = useAppSelector((state) => state.realtime.cinemaStatusVersion);
  useEffect(() => {
    if (statusVersion > 0) queryClient.invalidateQueries({ queryKey: myCinemasQueryKey });
  }, [statusVersion, queryClient]);

  return (
    <AdminLayout breadcrumb={t('cinemas.breadcrumb')}>
      <div className="mt-6">
        <DataTable
          headers={[
            t('cinemas.headers.id'),
            t('cinemas.headers.name'),
            t('cinemas.headers.address'),
            t('cinemas.headers.city'),
            t('cinemas.headers.status'),
            t('cinemas.headers.actions'),
          ]}
        >
          {cinemas.map((cinema) => {
            const statusText = STATUS_LABEL[cinema.status] ?? STATUS_LABEL[CINEMA_STATUS.pending];
            const statusClassName =
              CINEMA_STATUS_META[cinema.status]?.className ?? CINEMA_STATUS_META[CINEMA_STATUS.pending].className;
            return (
              <tr key={cinema.id}>
                <td>{cinema.id}</td>
                <td>{cinema.name}</td>
                <td>{cinema.address}</td>
                <td>{cinema.city}</td>
                <td>
                  <span className={`rounded px-2 py-0.5 text-xs ${statusClassName}`}>{statusText}</span>
                </td>
                <td>
                  <Link to={ROUTES.ownerCinemaRooms(cinema.id)} className="text-accent no-underline">
                    {t('cinemas.manageRooms')}
                  </Link>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </div>
    </AdminLayout>
  );
}

export default CinemaList;
