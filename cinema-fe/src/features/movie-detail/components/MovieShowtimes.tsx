import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SectionHeading } from '@/components/common/SectionHeading';
import { cn } from '@/lib/cn';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { useBookTicketSchedules } from '@/features/booking/hooks/useBookTicketSchedules';
import { getAvailableTimes } from '@/features/booking/utils/showtimes';
import { ROUTES } from '@/constants/routes';

/** Galaxy puts the showtime picker on the movie page itself: dates on top, times underneath. */
const MovieShowtimes = () => {
  const { t, i18n } = useTranslation('movieDetail');
  const { t: tCommon } = useTranslation('common');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isLoggedIn = useIsAuthenticated();
  const { data: schedules = [], isLoading } = useBookTicketSchedules(isLoggedIn ? id : undefined);
  const [day, setDay] = useState('');

  useEffect(() => {
    if (schedules.length > 0) setDay(schedules[0].movie_date);
  }, [schedules]);

  const weekdayFormatter = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' });
  const dayFormatter = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit' });

  const times = (() => {
    const schedule = schedules.find((item) => item.movie_date === day);
    return schedule ? getAvailableTimes(schedule.movie_date, schedule.times) : [];
  })();

  const goToSeats = (time: string) => {
    navigate(
      `${ROUTES.bookSeat}?movieId=${encodeURIComponent(id ?? '')}&day=${encodeURIComponent(day)}&time=${encodeURIComponent(time)}`,
    );
  };

  return (
    <section id="showtimes" className="w-full scroll-mt-24">
      <SectionHeading title={t('bannerDetail.showtimes')} />

      {!isLoggedIn ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-10 text-center shadow-card">
          <i className="fa-regular fa-calendar-days text-3xl text-accent" aria-hidden="true" />
          <p className="text-sm text-txt/70">{t('showtimes.loginPrompt')}</p>
          <Link
            to={ROUTES.login}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3 text-sm font-bold uppercase tracking-wide text-white no-underline shadow-card transition-all hover:bg-accent-hover hover:shadow-glow"
          >
            {tCommon('header.login')}
          </Link>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : schedules.length === 0 ? (
        <EmptyState title={t('showtimes.empty')} />
      ) : (
        <>
          <div className="themed-scrollbar flex gap-3 overflow-x-auto pb-2">
            {schedules.map((schedule) => {
              const date = new Date(schedule.movie_date);
              const isActive = day === schedule.movie_date;
              return (
                <button
                  key={schedule.movie_date}
                  type="button"
                  onClick={() => setDay(schedule.movie_date)}
                  className={cn(
                    'flex h-[68px] w-[76px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-border-strong text-txt transition-all hover:border-accent hover:text-white',
                    isActive && 'border-accent bg-accent text-white shadow-glow',
                  )}
                >
                  <span className="text-[11px] font-medium uppercase opacity-80">
                    {weekdayFormatter.format(date)}
                  </span>
                  <span className="text-base font-bold">{dayFormatter.format(date)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-card">
            <h3 className="flex items-center gap-3 text-sm font-bold uppercase tracking-wide text-white">
              <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              {t('showtimes.timesLabel')}
            </h3>
            {times.length === 0 ? (
              <EmptyState title={t('showtimes.empty')} />
            ) : (
              <div className="mt-5 flex flex-wrap gap-3">
                {times.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => goToSeats(time)}
                    className="min-w-[84px] rounded-lg border border-border-strong px-5 py-2.5 text-sm font-semibold text-txt transition-all hover:border-accent hover:bg-accent hover:text-white"
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default MovieShowtimes;
