import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '@/lib/socket';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { moviesQueryKey } from '@/features/movies/hooks/useMovies';
import { refreshAccessToken } from '@/services/apiClient';
import { setAccessToken } from '@/features/auth/store/authSlice';
import { bump } from './realtimeSlice';
import { toast } from './toast';
import type { BookingEvent, CinemaEvent, MovieEvent } from './types/realtime.types';

// Mounted once near the app root. Keeps a single socket connection alive for the
// session and fans server-pushed events out to Redux (for pages to refetch on) and
// toasts, so user/owner/admin views update without a manual page refresh.
export function RealtimeBridge() {
  const { t } = useTranslation('notifications');
  const token = useAppSelector((state) => state.auth.accessToken);
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  // Avoids refresh-retry loops if the server keeps rejecting the same connection attempt.
  const hasAttemptedRefresh = useRef(false);

  useEffect(() => {
    socket.auth = token ? { token } : {};
    if (socket.connected) socket.disconnect();
    socket.connect();
    hasAttemptedRefresh.current = false;
    return () => {
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    const onUnauthorized = () => {
      if (hasAttemptedRefresh.current) return;
      hasAttemptedRefresh.current = true;
      refreshAccessToken()
        .then((accessToken: string) => dispatch(setAccessToken(accessToken)))
        .catch(() => {});
    };

    socket.on('unauthorized', onUnauthorized);
    return () => {
      socket.off('unauthorized', onUnauthorized);
    };
  }, [dispatch]);

  useEffect(() => {
    const onMovieNew = (movie: MovieEvent) => {
      queryClient.invalidateQueries({ queryKey: moviesQueryKey });
      toast.info(t('realtimeBridge.newMovie', { name: movie?.name ?? '' }));
    };
    const onBranchActivated = (cinema: CinemaEvent) => {
      dispatch(bump('cinemaStatusVersion'));
      toast.success(t('realtimeBridge.branchActivated', { name: cinema?.name ?? '' }));
    };
    const onBranchDisabled = (cinema: CinemaEvent) => {
      dispatch(bump('cinemaStatusVersion'));
      toast.error(t('realtimeBridge.branchDisabled', { name: cinema?.name ?? '' }));
    };
    const onBranchMaintenance = (cinema: CinemaEvent) => {
      dispatch(bump('cinemaStatusVersion'));
      toast.info(t('realtimeBridge.branchMaintenance', { name: cinema?.name ?? '' }));
    };
    const onBookingNew = (payload: BookingEvent) => {
      dispatch(bump('ownerBookingVersion'));
      toast.info(t('realtimeBridge.newBooking', { amount: Number(payload?.amount ?? 0).toLocaleString() }));
    };

    socket.on('movie:new', onMovieNew);
    socket.on('branch:activated', onBranchActivated);
    socket.on('branch:disabled', onBranchDisabled);
    socket.on('branch:maintenance', onBranchMaintenance);
    socket.on('booking:new', onBookingNew);

    return () => {
      socket.off('movie:new', onMovieNew);
      socket.off('branch:activated', onBranchActivated);
      socket.off('branch:disabled', onBranchDisabled);
      socket.off('branch:maintenance', onBranchMaintenance);
      socket.off('booking:new', onBookingNew);
    };
    // Re-register listeners when the translator changes so socket callbacks
    // always use the current language instead of a stale closure over `t`.
  }, [dispatch, queryClient, t]);

  return null;
}
