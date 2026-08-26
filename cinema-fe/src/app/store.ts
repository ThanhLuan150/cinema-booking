import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import bookingReducer from '@/features/booking/store/bookingSlice';
import moviesReducer from '@/features/movies/store/moviesSlice';
import adminMoviesReducer from '@/features/admin/movies/store/adminMoviesSlice';
import ownerDashboardReducer from '@/features/owner/store/ownerDashboardSlice';
import ownerCinemasReducer from '@/features/owner/store/ownerCinemasSlice';
import ownerCombosReducer from '@/features/owner/store/ownerCombosSlice';
import ownerInventoryReducer from '@/features/owner/store/ownerInventorySlice';
import ownerVouchersReducer from '@/features/owner/store/ownerVouchersSlice';
import ownerPromotionsReducer from '@/features/owner/store/ownerPromotionsSlice';
import ownerPricingRulesReducer from '@/features/owner/store/ownerPricingRulesSlice';
import ownerHolidaysReducer from '@/features/owner/store/ownerHolidaysSlice';
import ownerEmployeesReducer from '@/features/owner/store/ownerEmployeesSlice';
import ownerShiftsReducer from '@/features/owner/store/ownerShiftsSlice';
import adminActorsReducer from '@/features/admin/actors/store/adminActorsSlice';
import adminDirectorsReducer from '@/features/admin/directors/store/adminDirectorsSlice';
import notificationsReducer from '@/features/notifications/notificationSlice';
import realtimeReducer from '@/features/notifications/realtimeSlice';
import confirmReducer from '@/features/notifications/confirmSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    booking: bookingReducer,
    movies: moviesReducer,
    adminMovies: adminMoviesReducer,
    ownerDashboard: ownerDashboardReducer,
    ownerCinemas: ownerCinemasReducer,
    ownerCombos: ownerCombosReducer,
    ownerInventory: ownerInventoryReducer,
    ownerVouchers: ownerVouchersReducer,
    ownerPromotions: ownerPromotionsReducer,
    ownerPricingRules: ownerPricingRulesReducer,
    ownerHolidays: ownerHolidaysReducer,
    ownerEmployees: ownerEmployeesReducer,
    ownerShifts: ownerShiftsReducer,
    adminActors: adminActorsReducer,
    adminDirectors: adminDirectorsReducer,
    notifications: notificationsReducer,
    realtime: realtimeReducer,
    confirm: confirmReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
