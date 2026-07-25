import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import type { MovieFilters } from '../types/movie.types';
import { FavoriteCinemaButton } from './FavoriteCinemaButton';
import { useCategories } from '../hooks/useCategories';
import { useCinemasList } from '../hooks/useCinemasList';
import { MOVIE_COUNTRIES } from '@/constants/countries';

export interface MovieFilterBarProps {
  filters: MovieFilters;
  onChange: (filters: MovieFilters) => void;
}

export function MovieFilterBar({ filters, onChange }: MovieFilterBarProps) {
  const { t } = useTranslation('movies');
  const { data: categories = [] } = useCategories();
  const { data: cinemas = [] } = useCinemasList();

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg bg-white/5 p-4">
      <div className="min-w-[160px] flex-1">
        <Select
          label={t('filterBar.category')}
          value={filters.category ?? ''}
          onChange={(e) => onChange({ ...filters, category: e.target.value || undefined })}
          options={categories.map((c) => ({ label: c.name, value: c.id }))}
          placeholder={t('filterBar.all')}
        />
      </div>
      <div className="min-w-[160px] flex-1">
        <Select
          label={t('filterBar.country')}
          value={filters.country ?? ''}
          onChange={(e) => onChange({ ...filters, country: e.target.value || undefined })}
          options={MOVIE_COUNTRIES.map((c) => ({ label: c, value: c }))}
          placeholder={t('filterBar.all')}
        />
      </div>
      <div className="flex min-w-[160px] flex-1 items-end gap-2">
        <div className="flex-1">
          <Select
            label={t('filterBar.cinema')}
            value={filters.cinema ?? ''}
            onChange={(e) => onChange({ ...filters, cinema: e.target.value || undefined })}
            options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
            placeholder={t('filterBar.all')}
          />
        </div>
        {filters.cinema && <FavoriteCinemaButton cinemaId={Number(filters.cinema)} />}
      </div>
      <div className="min-w-[160px] flex-1">
        <Input
          label={t('filterBar.date')}
          type="date"
          value={filters.date ?? ''}
          onChange={(e) => onChange({ ...filters, date: e.target.value || undefined })}
        />
      </div>
      <div className="min-w-[160px] flex-1">
        <Input
          label={t('filterBar.search')}
          type="text"
          placeholder={t('filterBar.searchPlaceholder')}
          value={filters.search ?? ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}
