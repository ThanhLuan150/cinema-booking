import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { socket } from '@/lib/socket';
import { REALTIME_EVENT } from '@/lib/realtimeEvents';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { refreshAccessToken } from '@/services/apiClient';
import { setAccessToken } from '@/features/auth/store/authSlice';
import type { Notification } from '@/types/entities';

import { moviesQueryKey } from '@/features/movies/hooks/useMovies';
import { myMoviesQueryKey } from '@/features/admin/movies/hooks/useMyMovies';
import { adminCinemasQueryKey } from '@/features/admin/cinemas/hooks/useAdminCinemas';
import { myCinemasQueryKey } from '@/features/owner/hooks/useMyCinemas';
import { allRoomsQueryKey } from '@/features/owner/hooks/useAllRooms';
import { schedulesQueryKey } from '@/features/admin/schedules/hooks/useSchedules';
import { bookingsQueryKey } from '@/features/booking/hooks/useBookings';
import { myInvoicesQueryKey } from '@/features/booking/hooks/useMyInvoices';
import { myTicketsQueryKey } from '@/features/booking/hooks/useMyTickets';
import { adminInvoicesQueryKey } from '@/features/admin/transactions/hooks/useAdminInvoices';
import { myPaymentsQueryKey } from '@/features/payment/hooks/useMyPayments';
import { adminPaymentsQueryKey } from '@/features/payment/hooks/useAdminPayments';
import { myRefundsQueryKey } from '@/features/refund/hooks/useMyRefunds';
import { adminRefundsQueryKey } from '@/features/refund/hooks/useAdminRefunds';
import { myGiftCardsQueryKey } from '@/features/giftCards/hooks/useMyGiftCards';
import { ownerGiftCardsQueryKey } from '@/features/owner/hooks/useOwnerGiftCards';
import { comboOrdersQueryKey } from '@/features/comboOrder/hooks/useComboOrders';
import { ownerCombosQueryKey } from '@/features/owner/hooks/useOwnerCombos';
import { checkinLogsQueryKey } from '@/features/owner/devices/hooks/useCheckinLogs';
import { devicesQueryKey } from '@/features/owner/devices/hooks/useDevices';
import { kiosksQueryKey } from '@/features/owner/kiosks/hooks/useKiosks';
import { entrancesQueryKey } from '@/features/owner/devices/hooks/useEntrances';
import { ownerMaintenanceQueryKey } from '@/features/owner/hooks/useOwnerMaintenance';
import { supportTicketsQueryKey } from '@/features/customerService/hooks/useSupportTickets';
import { parkingAreasQueryKey } from '@/features/owner/parking/hooks/useParkingAreas';
import { parkingSlotsQueryKey } from '@/features/owner/parking/hooks/useParkingSlots';
import { parkingTicketsQueryKey } from '@/features/owner/parking/hooks/useParkingTickets';
import { ownerInventoryQueryKey } from '@/features/owner/hooks/useOwnerInventory';
import { inventoryAlertsQueryKey } from '@/features/owner/hooks/useInventoryAlerts';
import { shiftAssignmentsQueryKey } from '@/features/owner/hooks/useShiftAssignments';
import { attendanceQueryKey } from '@/features/attendance/hooks/useAttendance';
import { myShiftAssignmentsQueryKey } from '@/features/employee/hooks/useMyShiftAssignments';
import { cashierShiftsQueryKey } from '@/features/cashierShift/hooks/useCashierShifts';
import { currentCashierShiftQueryKey } from '@/features/cashierShift/hooks/useCurrentCashierShift';
import { privateEventKeys } from '@/features/privateEvents/hooks/usePrivateEvents';
import { screensQueryKey, screenPlaybackQueryKey } from '@/features/owner/signage/hooks/useScreens';
import { signageContentsQueryKey } from '@/features/owner/signage/hooks/useSignageContents';
import { signageSchedulesQueryKey } from '@/features/owner/signage/hooks/useSignageSchedules';
import { myEmployeesQueryKey } from '@/features/owner/hooks/useMyEmployees';
import { campaignsQueryKey } from '@/features/owner/campaigns/hooks/useCampaigns';
import { ownerPromotionsQueryKey } from '@/features/owner/hooks/useOwnerPromotions';
import { ownerVouchersQueryKey } from '@/features/owner/hooks/useOwnerVouchers';
import { ownerPricingRulesQueryKey } from '@/features/owner/hooks/useOwnerPricingRules';
import { ownerHolidaysQueryKey } from '@/features/owner/hooks/useOwnerHolidays';
import { adminReviewsQueryKey } from '@/features/admin/reviews/hooks/useAdminReviews';
import { distributorsQueryKey } from '@/features/admin/distribution/hooks/useDistributors';
import { movieReleasesQueryKey } from '@/features/admin/distribution/hooks/useMovieReleases';
import { membershipLevelsQueryKey } from '@/features/membership/hooks/useMembershipLevels';
import { myMembershipQueryKey } from '@/features/membership/hooks/useMyMembership';
import { systemConfigQueryKey } from '@/features/admin/systemConfig/hooks/useSystemConfig';
import { auditLogsQueryKey } from '@/features/admin/auditLog/hooks/useAuditLogs';
import { integrationsQueryKey } from '@/features/admin/integrations/hooks/useIntegrations';
import { webhooksQueryKey } from '@/features/admin/integrations/hooks/useWebhooks';
import { notificationTemplatesQueryKey } from '@/features/admin/notificationTemplates/hooks/useNotificationTemplates';
import { notificationsQueryKey, unreadCountQueryKey } from '@/features/notifications/hooks/useNotifications';
import { actorsQueryKey } from '@/features/admin/actors/hooks/useActors';
import { directorsQueryKey } from '@/features/admin/directors/hooks/useDirectors';
import { adminUsersQueryKey } from '@/features/admin/users/hooks/useAdminUsers';
import { myLikedMoviesQueryKey } from '@/features/movies/hooks/useMyLikedMovies';
import { myPointsHistoryQueryKey } from '@/features/membership/hooks/useMyPointsHistory';

import { bump } from './realtimeSlice';
import { toast } from './toast';
import type { BookingEvent, CinemaEvent, MovieEvent, ShowtimeChangeEvent } from './types/realtime.types';

// Every server event that only needs "the lists that show this thing are now stale". The server
// scopes delivery (an event reaches a room, not everyone), so a client that receives one is by
// definition allowed to see the data — invalidating is safe, and react-query only refetches the
// queries a mounted component is actually observing, so a customer's idle admin keys cost nothing.
//
// Events that additionally raise a toast, bump a Redux counter or need the payload are handled
// separately below. The live seat map is NOT here: it is per-showtime and owned by
// features/booking/hooks/useBookedSeats, which knows the schedule id to join and invalidate.
const INVALIDATIONS: Record<string, QueryKey[]> = {
  [REALTIME_EVENT.MOVIE_UPDATED]: [moviesQueryKey, myMoviesQueryKey],
  [REALTIME_EVENT.MOVIE_REMOVED]: [moviesQueryKey, myMoviesQueryKey],
  // A branch going live or dark reaches everyone as branch:updated, so the customer-facing
  // cinema picker and homepage ranking have to drop their cached copies too — not just the
  // admin/owner lists.
  [REALTIME_EVENT.BRANCH_UPDATED]: [adminCinemasQueryKey, myCinemasQueryKey, ['cinemas'], ['topCinemas']],
  [REALTIME_EVENT.SCHEDULE_UPDATED]: [schedulesQueryKey, moviesQueryKey],
  [REALTIME_EVENT.BOOKING_UPDATED]: [bookingsQueryKey, myInvoicesQueryKey, myTicketsQueryKey, adminInvoicesQueryKey],
  [REALTIME_EVENT.PAYMENT_UPDATED]: [myPaymentsQueryKey, adminPaymentsQueryKey, bookingsQueryKey, myInvoicesQueryKey],
  [REALTIME_EVENT.REFUND_UPDATED]: [myRefundsQueryKey, adminRefundsQueryKey],
  [REALTIME_EVENT.GIFT_CARD_UPDATED]: [myGiftCardsQueryKey, ownerGiftCardsQueryKey],
  [REALTIME_EVENT.COMBO_ORDER_UPDATED]: [comboOrdersQueryKey],
  [REALTIME_EVENT.COMBO_UPDATED]: [ownerCombosQueryKey],
  [REALTIME_EVENT.CHECKIN_NEW]: [checkinLogsQueryKey, bookingsQueryKey, myTicketsQueryKey],
  [REALTIME_EVENT.MAINTENANCE_UPDATED]: [ownerMaintenanceQueryKey],
  [REALTIME_EVENT.ROOM_UPDATED]: [allRoomsQueryKey],
  [REALTIME_EVENT.SUPPORT_UPDATED]: [supportTicketsQueryKey],
  [REALTIME_EVENT.PARKING_UPDATED]: [parkingAreasQueryKey, parkingSlotsQueryKey, parkingTicketsQueryKey],
  [REALTIME_EVENT.INVENTORY_UPDATED]: [ownerInventoryQueryKey, inventoryAlertsQueryKey],
  [REALTIME_EVENT.SHIFT_UPDATED]: [shiftAssignmentsQueryKey, myShiftAssignmentsQueryKey],
  [REALTIME_EVENT.ATTENDANCE_UPDATED]: [attendanceQueryKey],
  [REALTIME_EVENT.CASHIER_SHIFT_UPDATED]: [cashierShiftsQueryKey, currentCashierShiftQueryKey],
  [REALTIME_EVENT.PRIVATE_EVENT_UPDATED]: [privateEventKeys.packages, privateEventKeys.mine, privateEventKeys.admin],
  [REALTIME_EVENT.SIGNAGE_UPDATED]: [
    screensQueryKey,
    screenPlaybackQueryKey,
    signageContentsQueryKey,
    signageSchedulesQueryKey,
  ],
  [REALTIME_EVENT.DEVICE_UPDATED]: [devicesQueryKey],
  [REALTIME_EVENT.KIOSK_UPDATED]: [kiosksQueryKey],
  [REALTIME_EVENT.ENTRANCE_UPDATED]: [entrancesQueryKey],
  // A Position change (or deactivation) rewrites what the employee may do, and their menu is
  // built from the cached permission set — so the affected person's own profile + permissions are
  // dropped too, not just the roster a manager is looking at. The server only sends this to that
  // employee, their Branch Admin and Super Admin, so a refetch here is always for the right person.
  [REALTIME_EVENT.EMPLOYEE_UPDATED]: [myEmployeesQueryKey, ['currentUser'], ['myPermissions']],
  [REALTIME_EVENT.CAMPAIGN_UPDATED]: [campaignsQueryKey],
  [REALTIME_EVENT.PROMOTION_UPDATED]: [ownerPromotionsQueryKey],
  [REALTIME_EVENT.VOUCHER_UPDATED]: [ownerVouchersQueryKey],
  [REALTIME_EVENT.REVIEW_UPDATED]: [adminReviewsQueryKey],
  [REALTIME_EVENT.DISTRIBUTION_UPDATED]: [distributorsQueryKey, movieReleasesQueryKey],
  [REALTIME_EVENT.MEMBERSHIP_UPDATED]: [membershipLevelsQueryKey, myMembershipQueryKey],
  [REALTIME_EVENT.SYSTEM_CONFIG_UPDATED]: [systemConfigQueryKey],
  // A price rule or holiday changes what a seat costs, and the seat grid carries per-seat prices.
  [REALTIME_EVENT.PRICING_UPDATED]: [ownerPricingRulesQueryKey, ownerHolidaysQueryKey, ['bookedSeats']],
  [REALTIME_EVENT.AUDIT_LOG_NEW]: [auditLogsQueryKey],
  [REALTIME_EVENT.INTEGRATION_UPDATED]: [integrationsQueryKey],
  [REALTIME_EVENT.WEBHOOK_UPDATED]: [webhooksQueryKey],
  [REALTIME_EVENT.NOTIFICATION_TEMPLATE_UPDATED]: [notificationTemplatesQueryKey],
  // Cast, crew, genres and the movie link tables — all of it renders on a public movie page, so
  // the movie itself is invalidated alongside the list that was edited.
  [REALTIME_EVENT.CATALOGUE_UPDATED]: [actorsQueryKey, directorsQueryKey, ['categories'], ['movie'], moviesQueryKey],
  [REALTIME_EVENT.LIKE_UPDATED]: [['like'], myLikedMoviesQueryKey, ['movie']],
  // Being blocked, approved or given a different role changes what the caller's own session may
  // do, so their cached profile and permission set have to go, not just the admin list.
  [REALTIME_EVENT.USER_UPDATED]: [adminUsersQueryKey, ['currentUser'], ['myPermissions']],
  [REALTIME_EVENT.LOYALTY_UPDATED]: [myMembershipQueryKey, myPointsHistoryQueryKey],
  // A second tab marking something read must clear the bell here too.
  [REALTIME_EVENT.NOTIFICATION_READ]: [notificationsQueryKey, unreadCountQueryKey],
};

// Mounted once near the app root. Keeps a single socket connection alive for the
// session and fans server-pushed events out to react-query (so open lists refetch), Redux
// counters (for pages that fetch outside react-query) and toasts, so user/owner/admin views
// update without a manual page refresh.
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

    socket.on(REALTIME_EVENT.UNAUTHORIZED, onUnauthorized);
    return () => {
      socket.off(REALTIME_EVENT.UNAUTHORIZED, onUnauthorized);
    };
  }, [dispatch]);

  // The plain "this list is stale now" events.
  useEffect(() => {
    const handlers = Object.entries(INVALIDATIONS).map(([event, keys]) => {
      const handler = () => keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      socket.on(event, handler);
      return [event, handler] as const;
    });

    return () => {
      handlers.forEach(([event, handler]) => socket.off(event, handler));
    };
  }, [queryClient]);

  // The events that also say something to the user, or that a page watches through Redux.
  useEffect(() => {
    const onMovieNew = (movie: MovieEvent) => {
      queryClient.invalidateQueries({ queryKey: moviesQueryKey });
      dispatch(bump('catalogueVersion'));
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
    const onShowtimeCancelled = (_payload: ShowtimeChangeEvent) => {
      queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
      queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
      toast.info(t('realtimeBridge.showtimeCancelled'));
    };
    const onShowtimeRescheduled = (_payload: ShowtimeChangeEvent) => {
      queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
      queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
      toast.info(t('realtimeBridge.showtimeRescheduled'));
    };
    const onNotificationNew = (payload: Notification) => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      queryClient.invalidateQueries({ queryKey: unreadCountQueryKey });
      toast.info(payload?.title ?? t('realtimeBridge.notification'));
    };
    // The door feed: a branch's staff watch check-ins as they happen, so this one gets a toast
    // on top of its invalidation. FAILED scans matter more than successful ones.
    const onCheckin = (payload: { result?: string }) => {
      dispatch(bump('checkinVersion'));
      if (payload?.result && payload.result !== 'SUCCESS') {
        toast.error(t('realtimeBridge.checkinFailed'));
      }
    };
    const onOperationsEvent = () => dispatch(bump('operationsVersion'));

    socket.on(REALTIME_EVENT.MOVIE_NEW, onMovieNew);
    socket.on(REALTIME_EVENT.BRANCH_ACTIVATED, onBranchActivated);
    socket.on(REALTIME_EVENT.BRANCH_DISABLED, onBranchDisabled);
    socket.on(REALTIME_EVENT.BRANCH_MAINTENANCE, onBranchMaintenance);
    socket.on(REALTIME_EVENT.BOOKING_NEW, onBookingNew);
    socket.on(REALTIME_EVENT.SHOWTIME_CANCELLED, onShowtimeCancelled);
    socket.on(REALTIME_EVENT.SHOWTIME_RESCHEDULED, onShowtimeRescheduled);
    socket.on(REALTIME_EVENT.NOTIFICATION_NEW, onNotificationNew);
    socket.on(REALTIME_EVENT.CHECKIN_NEW, onCheckin);
    socket.on(REALTIME_EVENT.MAINTENANCE_UPDATED, onOperationsEvent);
    socket.on(REALTIME_EVENT.SUPPORT_UPDATED, onOperationsEvent);
    socket.on(REALTIME_EVENT.PARKING_UPDATED, onOperationsEvent);
    socket.on(REALTIME_EVENT.INVENTORY_UPDATED, onOperationsEvent);

    return () => {
      socket.off(REALTIME_EVENT.MOVIE_NEW, onMovieNew);
      socket.off(REALTIME_EVENT.BRANCH_ACTIVATED, onBranchActivated);
      socket.off(REALTIME_EVENT.BRANCH_DISABLED, onBranchDisabled);
      socket.off(REALTIME_EVENT.BRANCH_MAINTENANCE, onBranchMaintenance);
      socket.off(REALTIME_EVENT.BOOKING_NEW, onBookingNew);
      socket.off(REALTIME_EVENT.SHOWTIME_CANCELLED, onShowtimeCancelled);
      socket.off(REALTIME_EVENT.SHOWTIME_RESCHEDULED, onShowtimeRescheduled);
      socket.off(REALTIME_EVENT.NOTIFICATION_NEW, onNotificationNew);
      socket.off(REALTIME_EVENT.CHECKIN_NEW, onCheckin);
      socket.off(REALTIME_EVENT.MAINTENANCE_UPDATED, onOperationsEvent);
      socket.off(REALTIME_EVENT.SUPPORT_UPDATED, onOperationsEvent);
      socket.off(REALTIME_EVENT.PARKING_UPDATED, onOperationsEvent);
      socket.off(REALTIME_EVENT.INVENTORY_UPDATED, onOperationsEvent);
    };
    // Re-register listeners when the translator changes so socket callbacks
    // always use the current language instead of a stale closure over `t`.
  }, [dispatch, queryClient, t]);

  return null;
}
