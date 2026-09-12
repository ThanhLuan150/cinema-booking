import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

export interface FilterBarProps {
  cinemas: { id: number | string; name: string }[];
  roomOptions: { label: string; value: number | string }[];
  cinemaFilter: string;
  roomFilter: string;
  onCinemaFilterChange: (e: { target: { value: string } }) => void;
  onRoomFilterChange: (e: { target: { value: string } }) => void;
  canManageShowtimes: boolean;
  onAddClick: () => void;
}

export const FilterBar = ({
  cinemas,
  roomOptions,
  cinemaFilter,
  roomFilter,
  onCinemaFilterChange,
  onRoomFilterChange,
  canManageShowtimes,
  onAddClick,
}: FilterBarProps) => {
  const { t } = useTranslation('admin');

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3">
        <Select
          value={cinemaFilter}
          onChange={onCinemaFilterChange}
          placeholder={t('schedules.list.filterCinemaPlaceholder')}
          options={cinemas.map((cinema) => ({ label: cinema.name, value: cinema.id }))}
          className="w-56"
        />
        <Select
          value={roomFilter}
          onChange={onRoomFilterChange}
          placeholder={t('schedules.list.filterRoomPlaceholder')}
          options={roomOptions}
          className="w-56"
        />
      </div>
      {canManageShowtimes && (
        <Button type="button" variant="danger" onClick={onAddClick}>
          {t('schedules.list.addButton')}
        </Button>
      )}
    </div>
  );
};
