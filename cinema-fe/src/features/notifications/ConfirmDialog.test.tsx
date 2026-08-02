import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { closeConfirm } from './confirmSlice';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const resolveConfirmMock = vi.fn();
vi.mock('./confirm', () => ({
  resolveConfirm: (...args: unknown[]) => resolveConfirmMock(...args),
}));

import { ConfirmDialog } from './ConfirmDialog';
import { openConfirm } from './confirmSlice';

function renderDialog() {
  return render(
    <Provider store={store}>
      <ConfirmDialog />
    </Provider>,
  );
}

describe('ConfirmDialog (notifications)', () => {
  beforeEach(() => {
    store.dispatch(closeConfirm());
    resolveConfirmMock.mockReset();
  });

  it('renders nothing when there is no pending request', () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the request message and title', () => {
    store.dispatch(openConfirm({ id: 1, message: 'Delete this booking?', title: 'Confirm delete' }));
    renderDialog();
    expect(screen.getByText('Delete this booking?')).toBeInTheDocument();
    expect(screen.getByText('Confirm delete')).toBeInTheDocument();
  });

  it('calls resolveConfirm(id, false) when cancelled', () => {
    store.dispatch(openConfirm({ id: 7, message: 'Sure?' }));
    renderDialog();
    fireEvent.click(screen.getByText('confirmDialog.cancelLabel'));
    expect(resolveConfirmMock).toHaveBeenCalledWith(7, false);
  });

  it('calls resolveConfirm(id, true) when confirmed', () => {
    store.dispatch(openConfirm({ id: 7, message: 'Sure?' }));
    renderDialog();
    fireEvent.click(screen.getByText('confirmDialog.confirmLabel'));
    expect(resolveConfirmMock).toHaveBeenCalledWith(7, true);
  });
});
