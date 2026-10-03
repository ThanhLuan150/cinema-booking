import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import type { KdsBoard, KdsBranch, KdsOrder, KdsStatus } from '../types/kds.types';

// t() echoes the key plus any interpolation values, so assertions can tell cards apart.
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => {
        const values = opts
          ? Object.entries(opts)
              .filter(([name]) => name !== 'defaultValue')
              .map(([, value]) => String(value))
          : [];
        return values.length ? `${key}:${values.join(',')}` : key;
      },
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

let currentUser: { cinema_id: number | null; role: number } | undefined;
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: currentUser, isLoading: false }),
}));
let grantedPermissions = new Set<string>();
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: (code: string) => grantedPermissions.has(code) }),
}));

const useKdsBoardMock = vi.fn();
const mutateAsyncMock = vi.fn();
const useUpdateKdsStatusMock = vi.fn();
const useKdsBranchesMock = vi.fn();
vi.mock('../hooks/useKdsBoard', () => ({
  useKdsBoard: (...args: unknown[]) => useKdsBoardMock(...args),
  useKdsBranches: (...args: unknown[]) => useKdsBranchesMock(...args),
  useUpdateKdsStatus: (...args: unknown[]) => {
    useUpdateKdsStatusMock(...args);
    return { mutateAsync: mutateAsyncMock, isPending: false };
  },
}));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/features/notifications/toast', () => ({ toast: toastMock }));

import KitchenDisplayPage from './KitchenDisplayPage';

const NOW = Date.now();
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const NEXT: Record<KdsStatus, KdsOrder['next_statuses']> = {
  NEW: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

function order(id: number, status: KdsStatus, overrides: Partial<KdsOrder> = {}): KdsOrder {
  return {
    id,
    code: `CO-${id}`,
    branch_id: 1,
    status,
    items: [
      { combo_id: 1, name: 'Popcorn Combo', quantity: 2 },
      { combo_id: 2, name: 'Coke', quantity: 1 },
    ],
    item_count: 3,
    created_at: minutesAgo(4),
    status_changed_at: minutesAgo(3),
    timestamps: {
      NEW: minutesAgo(3),
      PREPARING: null,
      READY: null,
      COMPLETED: null,
      CANCELLED: null,
    },
    customer: null,
    booking: null,
    cancel_reason: null,
    next_statuses: NEXT[status],
    ...overrides,
  };
}

function boardOf(...orders: KdsOrder[]): KdsBoard {
  const counts = { NEW: 0, PREPARING: 0, READY: 0, COMPLETED: 0, CANCELLED: 0 };
  for (const o of orders) counts[o.status] += 1;
  return {
    branch_id: 1,
    server_time: new Date(NOW).toISOString(),
    recent_minutes: 60,
    statuses: ['NEW', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'],
    counts,
    truncated: false,
    orders,
  };
}

function showBoard(board: KdsBoard | undefined, extra: Record<string, unknown> = {}) {
  useKdsBoardMock.mockReturnValue({
    data: board,
    isLoading: false,
    isError: false,
    error: null,
    dataUpdatedAt: board ? NOW : 0,
    refetch: vi.fn(),
    isFetching: false,
    ...extra,
  });
}

const branch = (id: number, name: string, active: number): KdsBranch => ({
  id,
  name,
  status: 'ACTIVE',
  counts: { NEW: active, PREPARING: 0, READY: 0 },
  active,
});
const branchesAre = (...branches: KdsBranch[]) =>
  useKdsBranchesMock.mockReturnValue({ data: branches });

function renderPage() {
  const store = configureStore({ reducer: { auth: (s = {}) => s } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <KitchenDisplayPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>
  );
  const result = render(tree());
  return { ...result, rerenderPage: () => result.rerender(tree()) };
}

const lane = (key: string) => screen.getByRole('region', { name: new RegExp(`^lanes\\.${key}`) });
const card = (code: string) => screen.getByRole('article', { name: `card.label:${code}` });

describe('KitchenDisplayPage', () => {
  beforeEach(() => {
    currentUser = { cinema_id: 1, role: 3 }; // an Employee staffed at branch 1
    grantedPermissions = new Set(['combo.order.view', 'combo.order.update']); // F&B Staff
    [useKdsBoardMock, mutateAsyncMock, useUpdateKdsStatusMock, useKdsBranchesMock].forEach((m) =>
      m.mockReset(),
    );
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    branchesAre(branch(1, 'CineNova Central', 0));
  });

  it("opens the board of the employee's own branch", () => {
    showBoard(boardOf());
    renderPage();
    expect(useKdsBoardMock).toHaveBeenCalledWith(1);
    expect(useUpdateKdsStatusMock).toHaveBeenCalledWith(1);
    // No picker for staff — just the name of the kitchen they work in.
    expect(screen.queryByRole('button', { name: 'branchLabel' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CineNova Central' })).toBeInTheDocument();
  });

  it('sorts orders into New / Preparing / Ready / Done lanes', () => {
    showBoard(
      boardOf(
        order(1, 'NEW'),
        order(2, 'PREPARING'),
        order(3, 'READY'),
        order(4, 'COMPLETED', {
          timestamps: {
            NEW: minutesAgo(30),
            PREPARING: minutesAgo(25),
            READY: minutesAgo(20),
            COMPLETED: minutesAgo(10),
            CANCELLED: null,
          },
        }),
        order(5, 'CANCELLED', { cancel_reason: 'Machine broken' }),
      ),
    );
    renderPage();
    expect(within(lane('NEW')).getByText('CO-1')).toBeInTheDocument();
    expect(within(lane('PREPARING')).getByText('CO-2')).toBeInTheDocument();
    expect(within(lane('READY')).getByText('CO-3')).toBeInTheDocument();
    expect(within(lane('DONE')).getByText('CO-4')).toBeInTheDocument();
    expect(within(lane('DONE')).getByText('CO-5')).toBeInTheDocument();
    expect(within(card('CO-5')).getByText('card.reason:Machine broken')).toBeInTheDocument();
  });

  it('shows order id, items with quantity, created time, status, and customer/seat when present — never a price', () => {
    showBoard(
      boardOf(
        order(1, 'NEW', {
          customer: { id: 10, name: 'Lan Nguyen' },
          booking: {
            id: 3,
            code: 'BK-3',
            seats: ['B2', 'B10'],
            room: 'Hall 3',
            showtime: { date: '2026-10-02', time: '19:30' },
          },
        }),
      ),
    );
    const { container } = renderPage();
    const c = card('CO-1');
    expect(within(c).getByText('CO-1')).toBeInTheDocument();
    expect(within(c).getByText('Popcorn Combo')).toBeInTheDocument();
    expect(within(c).getByText('2×')).toBeInTheDocument();
    expect(within(c).getByText('1×')).toBeInTheDocument();
    expect(within(c).getByText(/^card\.createdAt:/)).toBeInTheDocument();
    expect(within(c).getByText('status.NEW')).toBeInTheDocument();
    expect(within(c).getByText('Lan Nguyen')).toBeInTheDocument();
    expect(within(c).getByText('B2, B10')).toBeInTheDocument();
    expect(within(c).getByText('Hall 3')).toBeInTheDocument();
    expect(within(c).getByText('19:30')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/đ|₫|VND|price/i);
  });

  it('omits the customer block for a walk-in order', () => {
    showBoard(boardOf(order(1, 'NEW')));
    renderPage();
    expect(within(card('CO-1')).queryByText('card.customer')).not.toBeInTheDocument();
  });

  it('lets F&B Staff move an order forward with one tap', async () => {
    mutateAsyncMock.mockResolvedValue({});
    showBoard(boardOf(order(1, 'NEW'), order(3, 'READY')));
    renderPage();

    fireEvent.click(within(card('CO-1')).getByRole('button', { name: 'actions.PREPARING' }));
    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        orderId: 1,
        status: 'PREPARING',
        reason: undefined,
      }),
    );
    expect(toastMock.success).toHaveBeenCalledWith('success.PREPARING:CO-1');

    fireEvent.click(within(card('CO-3')).getByRole('button', { name: 'actions.COMPLETED' }));
    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        orderId: 3,
        status: 'COMPLETED',
        reason: undefined,
      }),
    );
    // A READY order can no longer be cancelled.
    expect(
      within(card('CO-3')).queryByRole('button', { name: 'actions.cancel' }),
    ).not.toBeInTheDocument();
  });

  it('shows the server error when someone else moved the order first', async () => {
    mutateAsyncMock.mockRejectedValue({
      response: { data: { code: 'KDS_STATUS_CONFLICT', message: 'conflict' } },
    });
    showBoard(boardOf(order(2, 'PREPARING')));
    renderPage();
    fireEvent.click(within(card('CO-2')).getByRole('button', { name: 'actions.READY' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toastMock.error.mock.calls[0][0]).toMatch(/^errors:KDS_STATUS_CONFLICT/);
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('requires a reason before cancelling, then sends it', async () => {
    mutateAsyncMock.mockResolvedValue({});
    showBoard(boardOf(order(1, 'NEW')));
    renderPage();

    fireEvent.click(within(card('CO-1')).getByRole('button', { name: 'actions.cancel' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'cancelModal.submit' }));
    expect(within(dialog).getByText('cancelModal.reasonRequired')).toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('cancelModal.reasonLabel'), {
      target: { value: '  Out of corn ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'cancelModal.submit' }));
    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        orderId: 1,
        status: 'CANCELLED',
        reason: 'Out of corn',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('is read-only without combo.order.update', () => {
    grantedPermissions = new Set(['combo.order.view']);
    showBoard(boardOf(order(1, 'NEW'), order(2, 'PREPARING')));
    renderPage();
    expect(screen.getByText('readOnly')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^actions\./ })).not.toBeInTheDocument();
  });

  it('flags an order that has waited too long', () => {
    showBoard(
      boardOf(
        order(1, 'NEW'),
        order(2, 'PREPARING', {
          timestamps: {
            NEW: minutesAgo(25),
            PREPARING: minutesAgo(20),
            READY: null,
            COMPLETED: null,
            CANCELLED: null,
          },
        }),
      ),
    );
    renderPage();
    expect(card('CO-1')).toHaveAttribute('data-urgency', 'normal');
    expect(card('CO-2')).toHaveAttribute('data-urgency', 'late');
    expect(within(card('CO-2')).getByText('card.waiting:25')).toBeInTheDocument();
  });

  it('shows the per-status timestamps an order has reached', () => {
    showBoard(
      boardOf(
        order(3, 'READY', {
          timestamps: {
            NEW: minutesAgo(9),
            PREPARING: minutesAgo(6),
            READY: minutesAgo(1),
            COMPLETED: null,
            CANCELLED: null,
          },
        }),
      ),
    );
    renderPage();
    const timeline = within(card('CO-3')).getByRole('list', { name: 'card.timeline' });
    const rows = within(timeline)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^status\.NEW \d{2}:\d{2}$/);
    expect(rows[1]).toMatch(/^status\.PREPARING /);
    expect(rows[2]).toMatch(/^status\.READY /);
  });

  describe('Super Admin (no staffed branch)', () => {
    beforeEach(() => {
      currentUser = { cinema_id: null, role: 0 };
      showBoard(boardOf());
    });

    // Regression: the picker used to default to the first branch of /cinema/mine (newest id first) —
    // an empty "Events Hub" — so the Super Admin saw an empty board although other kitchens had orders.
    it('opens the kitchen with the most orders waiting, not simply the first branch', async () => {
      branchesAre(
        branch(950099, 'Events Hub', 0),
        branch(900001, 'Central', 7),
        branch(900002, 'Riverside', 4),
      );
      renderPage();
      await waitFor(() => expect(useKdsBoardMock).toHaveBeenLastCalledWith(900001));
      expect(screen.getByRole('button', { name: 'branchLabel' })).toHaveTextContent(
        'branchOption:Central,7',
      );
    });

    it('shows every branch with its waiting count and switches kitchen on pick', async () => {
      branchesAre(branch(1, 'Branch A', 2), branch(2, 'Branch B', 0));
      renderPage();
      await waitFor(() => expect(useKdsBoardMock).toHaveBeenLastCalledWith(1));

      fireEvent.click(screen.getByRole('button', { name: 'branchLabel' }));
      const options = within(screen.getByRole('listbox'));
      expect(options.getByText('branchOption:Branch A,2')).toBeInTheDocument();
      fireEvent.click(options.getByText('branchOption:Branch B,0'));
      await waitFor(() => expect(useKdsBoardMock).toHaveBeenLastCalledWith(2));
    });

    it('keeps the chosen kitchen when the counts change afterwards (no jumping)', async () => {
      branchesAre(branch(1, 'Branch A', 3), branch(2, 'Branch B', 1));
      const { rerenderPage } = renderPage();
      await waitFor(() => expect(useKdsBoardMock).toHaveBeenLastCalledWith(1));

      branchesAre(branch(1, 'Branch A', 0), branch(2, 'Branch B', 9)); // a realtime refresh
      rerenderPage();
      expect(useKdsBoardMock).toHaveBeenLastCalledWith(1);
    });

    it('says so when there is no branch to display', () => {
      branchesAre();
      renderPage();
      expect(screen.getByText('noBranch')).toBeInTheDocument();
      expect(useKdsBoardMock).toHaveBeenLastCalledWith(null);
    });
  });

  it('shows a load error (e.g. 403 for a branch the user does not work at)', () => {
    showBoard(undefined, {
      isError: true,
      error: { response: { data: { message: 'Forbidden' } } },
    });
    renderPage();
    expect(screen.getByText(/loadError/)).toBeInTheDocument();
  });
});

// jsdom has neither PointerEvent nor layout, so: a minimal PointerEvent (a MouseEvent with a
// pointerId), and elementFromPoint mapped from an x coordinate to a lane — each lane "occupies" a
// 200px column, the way the 4-column board lays out on a wide screen.
if (typeof window.PointerEvent === 'undefined') {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  (window as unknown as { PointerEvent: typeof TestPointerEvent }).PointerEvent = TestPointerEvent;
}
const LANE_X = { NEW: 100, PREPARING: 300, READY: 500, DONE: 700 } as const;
type LaneKey = keyof typeof LANE_X;

describe('KitchenDisplayPage drag and drop', () => {
  const originalElementFromPoint = document.elementFromPoint;

  beforeEach(() => {
    currentUser = { cinema_id: 1, role: 3 };
    grantedPermissions = new Set(['combo.order.view', 'combo.order.update']);
    [useKdsBoardMock, mutateAsyncMock, useUpdateKdsStatusMock, useKdsBranchesMock].forEach((m) =>
      m.mockReset(),
    );
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    branchesAre(branch(1, 'CineNova Central', 0));
    document.elementFromPoint = ((x: number) => {
      const key = (Object.keys(LANE_X) as LaneKey[]).find((k) => Math.abs(LANE_X[k] - x) < 100);
      return key ? document.querySelector(`[data-kds-lane="${key}"]`) : null;
    }) as typeof document.elementFromPoint;
  });
  afterEach(() => {
    document.elementFromPoint = originalElementFromPoint;
  });

  const press = (code: string, at: number = LANE_X.NEW) =>
    fireEvent.pointerDown(within(card(code)).getByRole('heading', { name: code }), {
      pointerId: 1,
      button: 0,
      clientX: at,
      clientY: 100,
    });
  const moveTo = (x: number, y = 140) =>
    fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y });
  const release = (x: number, y = 140) =>
    fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y });
  const dragTo = (code: string, to: LaneKey, from: LaneKey = 'NEW') => {
    press(code, LANE_X[from]);
    moveTo(LANE_X[to]);
    release(LANE_X[to]);
  };
  const ghost = () => screen.queryByTestId('kds-drag-ghost');

  it('starts preparing a NEW order when it is dragged into the Preparing lane', async () => {
    mutateAsyncMock.mockResolvedValue({});
    showBoard(boardOf(order(1, 'NEW')));
    renderPage();
    dragTo('CO-1', 'PREPARING');
    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        orderId: 1,
        status: 'PREPARING',
        reason: undefined,
      }),
    );
    expect(toastMock.success).toHaveBeenCalledWith('success.PREPARING:CO-1');
  });

  it('moves every step by drag: Preparing -> Ready, Ready -> Done (complete)', async () => {
    mutateAsyncMock.mockResolvedValue({});
    showBoard(boardOf(order(2, 'PREPARING'), order(3, 'READY')));
    renderPage();
    dragTo('CO-2', 'READY', 'PREPARING');
    dragTo('CO-3', 'DONE', 'READY');
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(2));
    expect(mutateAsyncMock).toHaveBeenNthCalledWith(1, {
      orderId: 2,
      status: 'READY',
      reason: undefined,
    });
    expect(mutateAsyncMock).toHaveBeenNthCalledWith(2, {
      orderId: 3,
      status: 'COMPLETED',
      reason: undefined,
    });
  });

  it('while dragging, highlights only the next lane and shows the card following the pointer', () => {
    showBoard(boardOf(order(1, 'NEW')));
    renderPage();
    press('CO-1');
    moveTo(LANE_X.PREPARING);

    expect(ghost()).toBeInTheDocument();
    expect(lane('PREPARING')).toHaveAttribute('data-drop-target', 'true');
    expect(within(lane('PREPARING')).getByText('drop.PREPARING')).toBeInTheDocument();
    expect(lane('READY')).not.toHaveAttribute('data-drop-target');
    expect(lane('DONE')).not.toHaveAttribute('data-drop-target');
    expect(card('CO-1').className).toContain('opacity-40'); // the original stays, dimmed

    release(LANE_X.PREPARING);
    expect(ghost()).not.toBeInTheDocument();
  });

  it('dropping anywhere but the next lane does nothing — no skipping, no going back', async () => {
    showBoard(boardOf(order(1, 'NEW'), order(3, 'READY')));
    renderPage();
    dragTo('CO-1', 'READY'); // skip a lane
    dragTo('CO-1', 'DONE'); // skip two (and never "cancel by drop")
    dragTo('CO-3', 'PREPARING', 'READY'); // backwards
    press('CO-1');
    moveTo(LANE_X.PREPARING);
    release(2000); // let go outside the board
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(ghost()).not.toBeInTheDocument();
  });

  it('keeps a short press a tap: no drag below the movement threshold', () => {
    showBoard(boardOf(order(1, 'NEW')));
    renderPage();
    press('CO-1');
    moveTo(LANE_X.NEW + 3, 102);
    expect(ghost()).not.toBeInTheDocument();
    release(LANE_X.NEW + 3, 102);
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('never starts a drag from a button, so clicking keeps working', async () => {
    mutateAsyncMock.mockResolvedValue({});
    showBoard(boardOf(order(1, 'NEW')));
    renderPage();
    const start = within(card('CO-1')).getByRole('button', { name: 'actions.PREPARING' });
    fireEvent.pointerDown(start, { pointerId: 1, button: 0, clientX: LANE_X.NEW, clientY: 100 });
    moveTo(LANE_X.PREPARING);
    expect(ghost()).not.toBeInTheDocument();
    release(LANE_X.PREPARING);
    fireEvent.click(start);
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
  });

  it('abandons the drag when the browser takes the gesture (scroll) or Escape is pressed', () => {
    showBoard(boardOf(order(1, 'NEW')));
    renderPage();
    press('CO-1');
    moveTo(LANE_X.PREPARING);
    fireEvent.pointerCancel(window, { pointerId: 1 });
    expect(ghost()).not.toBeInTheDocument();

    press('CO-1');
    moveTo(LANE_X.PREPARING);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(ghost()).not.toBeInTheDocument();
    release(LANE_X.PREPARING);
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('cannot drag without combo.order.update, nor a finished order', () => {
    grantedPermissions = new Set(['combo.order.view']);
    showBoard(boardOf(order(1, 'NEW'), order(6, 'COMPLETED')));
    renderPage();
    expect(card('CO-1')).not.toHaveAttribute('data-draggable');
    expect(card('CO-6')).not.toHaveAttribute('data-draggable');
    dragTo('CO-1', 'PREPARING');
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('moves the card at once, and puts it back with the reason if the server refuses', async () => {
    let refuse: (reason: unknown) => void = () => {};
    mutateAsyncMock.mockReturnValue(new Promise((_, reject) => (refuse = reject)));
    showBoard(boardOf(order(1, 'NEW')));
    renderPage();
    dragTo('CO-1', 'PREPARING');

    // Shown in Preparing straight away, marked as saving, with no further actions meanwhile.
    expect(within(lane('PREPARING')).getByText('CO-1')).toBeInTheDocument();
    expect(card('CO-1')).toHaveAttribute('data-saving', 'true');
    expect(within(card('CO-1')).queryByRole('button')).not.toBeInTheDocument();

    refuse({ response: { data: { code: 'KDS_STATUS_CONFLICT' } } });
    await waitFor(() => expect(within(lane('NEW')).getByText('CO-1')).toBeInTheDocument());
    expect(card('CO-1')).not.toHaveAttribute('data-saving');
    expect(toastMock.error.mock.calls[0][0]).toMatch(/^errors:KDS_STATUS_CONFLICT/);
  });
});
