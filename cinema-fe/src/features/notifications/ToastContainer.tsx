import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { dismissToast } from './notificationSlice';
import { cn } from '@/lib/cn';

const TYPE_CLASS: Record<string, string> = {
  success: 'border-green-500/50 bg-green-950/90 text-green-200',
  error: 'border-red-500/50 bg-red-950/90 text-red-200',
  info: 'border-white/20 bg-[#0B1A2A]/95 text-white',
};

const TYPE_ICON: Record<string, string> = {
  success: 'fa-circle-check text-green-400',
  error: 'fa-circle-xmark text-red-400',
  info: 'fa-circle-info text-accent',
};

export function ToastContainer() {
  const { t } = useTranslation('notifications');
  const toasts = useAppSelector((state) => state.notifications.toasts);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((item) =>
      setTimeout(() => dispatch(dismissToast(item.id)), 4000),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dispatch]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-24 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={cn(
            'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur',
            TYPE_CLASS[item.type],
          )}
        >
          <i className={cn('fa-solid mt-0.5', TYPE_ICON[item.type])} />
          <p className="flex-1">{item.message}</p>
          <button
            type="button"
            onClick={() => dispatch(dismissToast(item.id))}
            className="text-white/50 hover:text-white"
            aria-label={t('toastContainer.dismiss')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      ))}
    </div>
  );
}
