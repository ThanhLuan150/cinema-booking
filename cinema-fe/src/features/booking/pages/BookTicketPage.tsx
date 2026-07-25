import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { toast } from '@/features/notifications/toast';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
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
    <section className="flex min-h-screen bg-[#06121E] mt-10 jutif">
      <div className="mx-auto w-[1220px] max-w-full">
        <div className="bg-[#0B1A2A] px-10 py-5">
          <h1 className="font-serif text-[#d8bd24]">{t('bookTicket.pageTitle')}</h1>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" />
            </div>
          ) : scheduleData.length === 0 ? (
            <EmptyState title={t('bookTicket.noSchedule')} />
          ) : (
            <>
              <div className="border-y-2 border-[rgb(212,202,202)] px-10 py-5">
                <h2 className="mb-10 font-serif text-[25px] text-[rgb(212,202,202)]">{t('bookTicket.dateLabel')}</h2>
                <div className="flex flex-wrap">
                  {scheduleData.map((schedule) => (
                    <button
                      key={schedule.movie_date}
                      type="button"
                      className={cn(
                        'relative left-[13px] ml-6 flex h-[60px] w-[65px] items-center justify-center rounded border-2 border-[whitesmoke] font-serif text-[20px] text-[rgb(212,202,202)] hover:border-[#d8bd24]',
                        selectedDay === schedule.movie_date && 'border-none bg-[#d8bd24]',
                      )}
                      onClick={() => dispatch(setSelectedDay(schedule.movie_date))}
                    >
                      <span className="pointer-events-none text-white">{schedule.movie_date}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-y-2 border-[rgb(212,202,202)] px-10 py-5">
                <h2 className="mb-10 font-serif text-[25px] text-[rgb(212,202,202)]">{t('bookTicket.timeLabel')}</h2>
                {times.length === 0 && <EmptyState title={t('bookTicket.noAvailableTimes')} />}
                <div className="flex flex-wrap gap-[5px]">
                  {times.map((time) => (
                    <button
                      key={time}
                      type="button"
                      className={cn(
                        'mr-4 rounded-[3px] border-none px-8 py-2 font-serif text-[20px] hover:bg-black',
                        selectedTime === time && 'bg-[#d8bd24]',
                      )}
                      onClick={() => dispatch(setSelectedTime(time))}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
              <center>
                <button
                  id="submit-btn"
                  className="mt-8 rounded-[3px] border-none bg-yellow-400 px-4 py-2 font-serif text-[2em] text-black hover:bg-black hover:text-white"
                  onClick={handleSubmit}
                >
                  {t('bookTicket.bookButton')}
                </button>
              </center>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default BookTicketPage;
