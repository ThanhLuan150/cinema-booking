import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { CINEMA_STATUS, CINEMA_STATUS_META } from '@/constants/cinemaStatus';
import type { Cinema } from '@/types/entities';

export interface ListItemProps {
  cinema: Cinema;
  onActivate: (id: number) => void;
  onDisable: (id: number) => void;
  onMaintenance: (id: number) => void;
  onDelete: (id: number) => void;
}

export function ListItem({ cinema, onActivate, onDisable, onMaintenance, onDelete }: ListItemProps) {
  const { t } = useTranslation('admin');
  const status = CINEMA_STATUS_META[cinema.status] || CINEMA_STATUS_META[CINEMA_STATUS.active];

  return (
    <tr>
      <td>{cinema.id}</td>
      <td>
        <Avatar src={cinema.owner_avatar} name={cinema.owner_name} size="sm" />
      </td>
      <td>{cinema.name}</td>
      <td>{cinema.owner_id}</td>
      <td>
        {cinema.address} {cinema.city}
      </td>
      <td>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${status.className}`}>
          {t(`cinemas.status.${status.key}`)}
        </span>
      </td>
      <td className="flex gap-3">
        {cinema.status !== CINEMA_STATUS.active && (
          <button
            type="button"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            onClick={() => onActivate(cinema.id)}
          >
            {t('cinemas.activateButton')}
          </button>
        )}
        {cinema.status !== CINEMA_STATUS.inactive && (
          <button
            type="button"
            className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
            onClick={() => onDisable(cinema.id)}
          >
            {t('cinemas.disableButton')}
          </button>
        )}
        {cinema.status !== CINEMA_STATUS.maintenance && (
          <button
            type="button"
            className="text-sm font-medium text-amber-400 transition-colors hover:text-amber-300"
            onClick={() => onMaintenance(cinema.id)}
          >
            {t('cinemas.maintenanceButton')}
          </button>
        )}
        <button
          type="button"
          className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
          onClick={() => onDelete(cinema.id)}
        >
          {t('cinemas.deleteButton')}
        </button>
      </td>
    </tr>
  );
}
