import { store } from '@/app/store';
import { showToast } from './notificationSlice';
import type { ToastType } from './types/toast.types';

// Drop-in replacement for window.alert(): dispatches straight to the Redux store so
// it can be called from plain functions/handlers too, not just React components.
export function toast(message: string, type: ToastType = 'info') {
  store.dispatch(showToast(message, type));
}

toast.success = (message: string) => toast(message, 'success');
toast.error = (message: string) => toast(message, 'error');
toast.info = (message: string) => toast(message, 'info');
