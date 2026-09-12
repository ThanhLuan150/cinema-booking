import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { CINEMA_STATUS, CINEMA_STATUS_META } from '@/constants/cinemaStatus';
import { ROUTES } from '@/constants/routes';
import type { Cinema } from '@/types/entities';

interface CinemaTableProps {
  cinemas: Cinema[];
}

export function CinemaTable({ cinemas }: CinemaTableProps) {
  const { t } = useTranslation('owner');

  return (
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
          const statusMeta = CINEMA_STATUS_META[cinema.status] ?? CINEMA_STATUS_META[CINEMA_STATUS.active];
          const statusText = t(`cinemas.status.${statusMeta.key}`);
          const statusClassName = statusMeta.className;
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
  );
}
