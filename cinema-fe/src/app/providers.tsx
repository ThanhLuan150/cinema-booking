import { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { store } from '@/app/store';
import { queryClient } from '@/lib/queryClient';
import { ToastContainer } from '@/features/notifications/ToastContainer';
import { RealtimeBridge } from '@/features/notifications/RealtimeBridge';
import { ConfirmDialog } from '@/features/notifications/ConfirmDialog';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <RealtimeBridge />
          {children}
          <ToastContainer />
          <ConfirmDialog />
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </BrowserRouter>
      </Provider>
    </QueryClientProvider>
  );
}
