import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { usePermissions } from '@/hooks/usePermissions';
import type { Room } from '@/types/entities';
import { ROOM_STATUS_BADGE } from '../constants';

interface RoomsTableProps {
  rooms: Room[];
  onSeatMap: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

export function RoomsTable({ rooms, onSeatMap, onEdit, onDelete }: RoomsTableProps) {
  const { t } = useTranslation('owner');
  const { hasPermission } = usePermissions();

  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('rooms.headers.id'),
          t('rooms.headers.name'),
          t('rooms.headers.code'),
          t('rooms.headers.type'),
          t('rooms.headers.capacity'),
          t('rooms.headers.status'),
          t('rooms.headers.actions'),
        ]}
      >
        {rooms.map((room) => (
          <tr key={room.id}>
            <td>{room.id}</td>
            <td>{room.name}</td>
            <td>{room.code}</td>
            <td>{room.type}</td>
            <td>{room.capacity}</td>
            <td>
              <Badge variant={ROOM_STATUS_BADGE[room.status] ?? 'default'}>
                {t(`rooms.statusLabels.${room.status}`)}
              </Badge>
            </td>
            <td className="flex flex-wrap gap-3">
              <button
                type="button"
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                onClick={() => onSeatMap(room.id)}
              >
                {t('rooms.seatMapAction')}
              </button>
              {hasPermission('room.update') && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => onEdit(room.id)}
                >
                  {t('rooms.edit')}
                </button>
              )}
              {hasPermission('room.delete') && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => onDelete(room.id)}
                >
                  {t('rooms.delete')}
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
