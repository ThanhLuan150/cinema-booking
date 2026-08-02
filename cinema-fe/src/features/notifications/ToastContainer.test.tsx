import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { showToast, dismissToast } from './notificationSlice';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ToastContainer } from './ToastContainer';

function renderContainer() {
  return render(
    <Provider store={store}>
      <ToastContainer />
    </Provider>,
  );
}

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.getState().notifications.toasts.forEach((t) => store.dispatch(dismissToast(t.id)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = renderContainer();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a toast message', () => {
    store.dispatch(showToast('Saved successfully', 'success'));
    renderContainer();
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });

  it('dismisses a toast when its close button is clicked', () => {
    store.dispatch(showToast('Oops', 'error'));
    renderContainer();
    fireEvent.click(screen.getByLabelText('toastContainer.dismiss'));
    expect(store.getState().notifications.toasts).toHaveLength(0);
  });

  it('auto-dismisses a toast after 4 seconds', () => {
    store.dispatch(showToast('Auto', 'info'));
    renderContainer();
    expect(screen.getByText('Auto')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(store.getState().notifications.toasts).toHaveLength(0);
  });
});
