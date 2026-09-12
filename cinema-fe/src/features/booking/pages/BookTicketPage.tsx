import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { toast } from '@/features/notifications/toast';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { useBookTicketSchedules } from '../hooks/useBookTicketSchedules';
import { getAvailableTimes } from '../utils/showtimes';
import { BookingSteps } from '../components/BookingSteps';
import { MovieSummaryHeader } from '../components/MovieSummaryHeader';
import { DateChips } from '../components/DateChips';
import { TimeChips } from '../components/TimeChips';
import { resetBookingSelection, setSelectedDay, setSelectedTime } from '../store/bookingSlice';
import { ROUTES } from '@/constants/routes';

function BookTicketPage() {
  const { t } = useTranslation('booking');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const isLoggedIn = useIsAuthenticated();
  const { data: scheduleData = [], isLoading } = useBookTicketSchedules(
    isLoggedIn ? id : undefined,
  );
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
        <Breadcrumb items={[{ label: movie?.name ?? t('bookTicket.pageTitle') }]} />
        <BookingSteps current={1} />

        <div className="mx-auto w-full max-w-4xl px-6 pb-12 md:px-10">
          <div className="rounded-2xl border border-border bg-surface shadow-raised">
            <MovieSummaryHeader movie={movie} />

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
                <DateChips
                  schedules={scheduleData}
                  selectedDay={selectedDay}
                  onSelect={(movieDate) => dispatch(setSelectedDay(movieDate))}
                />

                <TimeChips
                  times={times}
                  selectedTime={selectedTime}
                  onSelect={(time) => dispatch(setSelectedTime(time))}
                />

                <div className="flex justify-center px-6 py-8 md:px-10">
                  <Button
                    type="button"
                    size="lg"
                    className="px-12 uppercase"
                    onClick={handleSubmit}
                  >
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
