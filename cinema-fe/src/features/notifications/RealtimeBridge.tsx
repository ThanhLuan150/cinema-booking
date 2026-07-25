import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '@/lib/socket';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { moviesQueryKey } from '@/features/movies/hooks/useMovies';
import { bump } from './realtimeSlice';
import { toast } from './toast';
import type { BookingEvent, CinemaEvent, MovieEvent } from './types/realtime.types';

// Mounted once near the app root. Keeps a single socket connection alive for the
// session and fans server-pushed events out to Redux (for pages to refetch on) and
// toasts, so user/owner/admin views update without a manual page refresh.
export function RealtimeBridge() {
  const { t } = useTranslation('notifications');
  const token = useAppSelector((state) => state.auth.token);
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  useEffect(() => {
    socket.auth = token ? { token } : {};
    if (socket.connected) socket.disconnect();
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    const onMovieNew = (movie: MovieEvent) => {
      queryClient.invalidateQueries({ queryKey: moviesQueryKey });
      toast.info(t('realtimeBridge.newMovie', { name: movie?.name ?? '' }));
    };
    const onCinemaPending = (cinema: CinemaEvent) => {
      dispatch(bump('cinemaPendingVersion'));
      toast.info(t('realtimeBridge.cinemaPending', { name: cinema?.name ?? '' }));
    };
    const onCinemaApproved = (cinema: CinemaEvent) => {
      dispatch(bump('cinemaStatusVersion'));
      toast.success(t('realtimeBridge.cinemaApproved', { name: cinema?.name ?? '' }));
    };
    const onCinemaBlocked = (cinema: CinemaEvent) => {
      dispatch(bump('cinemaStatusVersion'));
      toast.error(t('realtimeBridge.cinemaBlocked', { name: cinema?.name ?? '' }));
    };
    const onBookingNew = (payload: BookingEvent) => {
      dispatch(bump('ownerBookingVersion'));
      toast.info(t('realtimeBridge.newBooking', { amount: Number(payload?.amount ?? 0).toLocaleString() }));
    };

    socket.on('movie:new', onMovieNew);
    socket.on('cinema:pending', onCinemaPending);
    socket.on('cinema:approved', onCinemaApproved);
    socket.on('cinema:blocked', onCinemaBlocked);
    socket.on('booking:new', onBookingNew);

    return () => {
      socket.off('movie:new', onMovieNew);
      socket.off('cinema:pending', onCinemaPending);
      socket.off('cinema:approved', onCinemaApproved);
      socket.off('cinema:blocked', onCinemaBlocked);
      socket.off('booking:new', onBookingNew);
    };
    // Re-register listeners when the translator changes so socket callbacks
    // always use the current language instead of a stale closure over `t`.
  }, [dispatch, queryClient, t]);

  return null;
}
