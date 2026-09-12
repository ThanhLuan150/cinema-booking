import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import type { Booking } from '@/features/booking/types/booking.types';

export function BoxOfficeBookingSearch({
  searchCode,
  searchResults,
  onSearchCodeChange,
  onSearch,
  onSelectBooking,
}: {
  searchCode: string;
  searchResults: Booking[];
  onSearchCodeChange: (value: string) => void;
  onSearch: () => void;
  onSelectBooking: (booking: Booking) => void;
}) {
  const { t } = useTranslation('employee');
  return (
    <div className="mt-10 max-w-md">
      <h6 className="mb-3 font-semibold text-white">{t('boxOffice.search.title')}</h6>
      <div className="flex gap-2">
        <Input
          placeholder={t('boxOffice.search.placeholder')}
          value={searchCode}
          onChange={(e) => onSearchCodeChange(e.target.value)}
        />
        <Button type="button" variant="secondary" onClick={onSearch}>
          {t('boxOffice.search.action')}
        </Button>
      </div>
      {searchResults.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {searchResults.map((booking) => (
            <button
              key={booking.id}
              type="button"
              onClick={() => onSelectBooking(booking)}
              className="flex items-center justify-between rounded-lg border border-border-strong px-3 py-2.5 text-left text-sm text-txt/80 hover:border-accent/60"
            >
              <span>{booking.code}</span>
              <Badge variant={booking.status === 'PAID' ? 'success' : 'default'}>{booking.status}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
