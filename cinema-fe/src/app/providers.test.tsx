import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/features/notifications/ToastContainer', () => ({ ToastContainer: () => <div>Toast Container</div> }));
vi.mock('@/features/notifications/RealtimeBridge', () => ({ RealtimeBridge: () => <div>Realtime Bridge</div> }));
vi.mock('@/features/notifications/ConfirmDialog', () => ({ ConfirmDialog: () => <div>Confirm Dialog</div> }));
vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div>React Query Devtools</div>,
}));

import { Providers } from './providers';

describe('Providers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders children alongside the notification providers', () => {
    render(
      <Providers>
        <div>Page Content</div>
      </Providers>,
    );

    expect(screen.getByText('Page Content')).toBeInTheDocument();
    expect(screen.getByText('Realtime Bridge')).toBeInTheDocument();
    expect(screen.getByText('Toast Container')).toBeInTheDocument();
    expect(screen.getByText('Confirm Dialog')).toBeInTheDocument();
  });

  it('renders the ReactQueryDevtools in dev mode', () => {
    vi.stubEnv('DEV', true);
    render(
      <Providers>
        <div>Page Content</div>
      </Providers>,
    );
    expect(screen.getByText('React Query Devtools')).toBeInTheDocument();
  });

  it('omits the ReactQueryDevtools outside of dev mode', () => {
    vi.stubEnv('DEV', false);
    render(
      <Providers>
        <div>Page Content</div>
      </Providers>,
    );
    expect(screen.queryByText('React Query Devtools')).not.toBeInTheDocument();
  });
});
