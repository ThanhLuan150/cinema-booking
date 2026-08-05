import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { useCinemasList } from '@/features/movies/hooks/useCinemasList';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { useBookTicketSchedules } from '@/features/booking/hooks/useBookTicketSchedules';
import { ROUTES } from '@/constants/routes';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { Button } from '@/components/ui/Button';

const QUICK_BOOKING_DAYS = 7;

// Galaxy's four-step quick booking bar: cinema -> movie -> date -> showtime.
// Showtimes come from the booking API, which needs a session, so a signed-out
// visitor picks from the next few days and finishes the flow on the ticket page.
const QuickBooking = () => {
  const { t, i18n } = useTranslation('home');
  const navigate = useNavigate();
  const isLoggedIn = useIsAuthenticated();
  const [cinema, setCinema] = useState('');
  const [movie, setMovie] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const { data: cinemasPage } = useCinemasList();
  const cinemas = cinemasPage?.data ?? [];

  // Only worth a request once a cinema narrows the list down.
  const { data: moviesPage } = useMovies(
    { cinema: cinema || undefined, status: 'playing' },
    { limit: FULL_LIST_FETCH_LIMIT },
    { enabled: !!cinema },
  );
  const movies = moviesPage?.data ?? [];

  const { data: schedules = [] } = useBookTicketSchedules(isLoggedIn && movie ? movie : undefined);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      }),
    [i18n.language],
  );

  const dateOptions = useMemo(() => {
    if (isLoggedIn && schedules.length > 0) {
      return schedules.map((schedule) => ({
        label: dateFormatter.format(new Date(schedule.movie_date)),
        value: schedule.movie_date,
      }));
    }
    return Array.from({ length: QUICK_BOOKING_DAYS }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() + index);
      return { label: dateFormatter.format(day), value: day.toISOString().split('T')[0] };
    });
  }, [isLoggedIn, schedules, dateFormatter]);

  const timeOptions = (schedules.find((schedule) => schedule.movie_date === date)?.times ?? []).map(
    (value) => ({ label: value, value }),
  );

  const steps = [
    {
      key: 'cinema',
      label: t('quickBooking.cinema'),
      value: cinema,
      options: cinemas.map((item) => ({ label: item.name, value: item.id })),
      disabled: false,
      placeholder: t('quickBooking.cinema'),
      onChange: (next: string) => {
        setCinema(next);
        setMovie('');
        setDate('');
        setTime('');
      },
    },
    {
      key: 'movie',
      label: t('quickBooking.movie'),
      value: movie,
      options: movies.map((item) => ({ label: item.name, value: item.id })),
      disabled: !cinema,
      placeholder:
        cinema && movies.length === 0 ? t('quickBooking.noMovie') : t('quickBooking.movie'),
      onChange: (next: string) => {
        setMovie(next);
        setDate('');
        setTime('');
      },
    },
    {
      key: 'date',
      label: t('quickBooking.date'),
      value: date,
      options: dateOptions,
      disabled: !movie,
      placeholder: t('quickBooking.date'),
      onChange: (next: string) => {
        setDate(next);
        setTime('');
      },
    },
    {
      key: 'time',
      label: t('quickBooking.time'),
      value: time,
      options: timeOptions,
      disabled: !date || timeOptions.length === 0,
      placeholder:
        date && timeOptions.length === 0 ? t('quickBooking.noTime') : t('quickBooking.time'),
      onChange: setTime,
    },
  ];

  const handleSubmit = () => {
    if (!movie) return;
    if (date && time) {
      navigate(
        `${ROUTES.bookSeat}?movieId=${encodeURIComponent(movie)}&day=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`,
      );
      return;
    }
    navigate(ROUTES.bookTicket(movie));
  };

  return (
    // Sits astride the bottom edge of the hero carousel on desktop, the way Galaxy's
    // booking bar does; on small screens it drops below so it can't cover the hero CTAs.
    <section className="relative z-10 mx-auto mt-5 w-full max-w-6xl px-4 pb-8 md:px-6 lg:-mt-8">
      <div className="overflow-hidden rounded-xl border border-border-strong bg-surface-raised shadow-raised">
        <div className="flex flex-col divide-y divide-border lg:flex-row lg:items-stretch lg:divide-x lg:divide-y-0">
          {steps.map((step, index) => (
            <div key={step.key} className="flex flex-1 items-center gap-3 px-4 py-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                {index + 1}
              </span>
              <Select
                aria-label={step.label}
                value={step.value}
                disabled={step.disabled}
                placeholder={step.placeholder}
                options={step.options}
                onChange={(event) => step.onChange(event.target.value)}
                className="w-full border-0 bg-transparent px-0 py-2 font-medium focus:ring-0"
              />
            </div>
          ))}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!movie}
            className="shrink-0 gap-2 rounded-none px-10 py-4 text-sm font-bold uppercase tracking-wide lg:w-56"
          >
            <i className="fa-solid fa-ticket" aria-hidden="true" />
            {t('quickBooking.submit')}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default QuickBooking;
