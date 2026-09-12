import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';

export function BoxOfficeMovieScheduleSelect({
  movieId,
  scheduleId,
  movieOptions,
  scheduleOptions,
  locked,
  onMovieChange,
  onScheduleChange,
}: {
  movieId: string;
  scheduleId: string;
  movieOptions: { label: string; value: number }[];
  scheduleOptions: { label: string; value: number }[];
  locked: boolean;
  onMovieChange: (movieId: string) => void;
  onScheduleChange: (scheduleId: string) => void;
}) {
  const { t } = useTranslation('employee');
  return (
    <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
      <Select
        label={t('boxOffice.movieLabel')}
        value={movieId}
        onChange={(e) => onMovieChange(e.target.value)}
        disabled={locked}
        placeholder={t('boxOffice.moviePlaceholder')}
        options={movieOptions}
      />
      <Select
        label={t('counterSale.scheduleLabel')}
        value={scheduleId}
        onChange={(e) => onScheduleChange(e.target.value)}
        disabled={locked || !movieId}
        placeholder={t('counterSale.schedulePlaceholder')}
        options={scheduleOptions}
      />
    </div>
  );
}
