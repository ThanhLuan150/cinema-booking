import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { toast } from '@/features/notifications/toast';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { useBookTicketSchedules } from '../hooks/useBookTicketSchedules';
import { resetBookingSelection, setSelectedDay, setSelectedTime } from '../store/bookingSlice';
import { ROUTES } from '@/constants/routes';

// MoMo-style: today's date only shows showtimes that haven't started yet.
function getAvailableTimes(movieDate: string, rawTimes: string[]) {
  const today = new Date().toISOString().split('T')[0];
  if (movieDate !== today) return rawTimes;
  const nowHHMM = new Date().toTimeString().slice(0, 5);
  return rawTimes.filter((time) => time >= nowHHMM);
}

function BookTicketPage() {
  const { t } = useTranslation('booking');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const isLoggedIn = useIsAuthenticated();
  const { data: scheduleData = [], isLoading } = useBookTicketSchedules(isLoggedIn ? id : undefined);
  const { selectedDay, selectedTime } = useAppSelector((state) => state.booking);
  const { data: movie } = useMovieDetail(id);

  // Every visit to this page starts a fresh selection — nothing should carry over from a previous booking attempt.
  useEffect(() => {
    dispatch(resetBookingSelection());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!isLoggedIn) {
      toast.error(t('bookTicket.notLoggedIn'));
      window.location.href = ROUTES.login;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    if (scheduleData.length === 0) return;
    dispatch(setSelectedDay(scheduleData[0].movie_date));
  }, [scheduleData, dispatch]);

  const times = (() => {
    const day = scheduleData.find((schedule) => schedule.movie_date === selectedDay);
    return day ? getAvailableTimes(day.movie_date, day.times) : [];
  })();

  const handleSubmit = () => {
    if (!selectedDay || !selectedTime) {
      toast.error(t('bookTicket.selectDateTime'));
      return;
    }
    const url = `${ROUTES.bookSeat}?movieId=${encodeURIComponent(id ?? '')}&day=${encodeURIComponent(selectedDay)}&time=${encodeURIComponent(selectedTime)}`;
    navigate(url);
  };

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-10">
          <div className="rounded-2xl border border-border bg-surface shadow-raised">
            <div className="border-b border-border px-6 py-6 md:px-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t('bookTicket.pageTitle')}</p>
              <h1 className="mt-1 text-xl font-bold text-white md:text-2xl">{movie?.name ?? ' '}</h1>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : scheduleData.length === 0 ? (
              <div className="px-6 py-10 md:px-10">
                <EmptyState title={t('bookTicket.noSchedule')} />
              </div>
            ) : (
              <>
                <div className="border-b border-border px-6 py-6 md:px-10">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-txt/60">
                    <i className="fa-regular fa-calendar text-accent" />
                    {t('bookTicket.dateLabel')}
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {scheduleData.map((schedule) => (
                      <button
                        key={schedule.movie_date}
                        type="button"
                        className={cn(
                          'flex h-16 w-20 flex-col items-center justify-center rounded-lg border-2 border-border-strong text-sm font-medium text-txt transition-all hover:border-gold',
                          selectedDay === schedule.movie_date &&
                            'border-gold bg-gold/15 text-gold shadow-glow-gold',
                        )}
                        onClick={() => dispatch(setSelectedDay(schedule.movie_date))}
                      >
                        {schedule.movie_date}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-b border-border px-6 py-6 md:px-10">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-txt/60">
                    <i className="fa-regular fa-clock text-accent" />
                    {t('bookTicket.timeLabel')}
                  </h2>
                  {times.length === 0 && <EmptyState title={t('bookTicket.noAvailableTimes')} />}
                  <div className="flex flex-wrap gap-3">
                    {times.map((time) => (
                      <button
                        key={time}
                        type="button"
                        className={cn(
                          'rounded-lg border-2 border-border-strong px-5 py-2.5 text-sm font-semibold text-txt transition-all hover:border-gold',
                          selectedTime === time && 'border-gold bg-gold/15 text-gold shadow-glow-gold',
                        )}
                        onClick={() => dispatch(setSelectedTime(time))}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center px-6 py-8 md:px-10">
                  <Button type="button" size="lg" className="px-12" onClick={handleSubmit}>
                    <i className="fa-solid fa-ticket" />
                    {t('bookTicket.bookButton')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default BookTicketPage;
