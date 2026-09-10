import '@/i18n';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerProfileCard } from './CustomerProfileCard';
import type { CustomerProfile } from '../types/crm.types';

function profile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    customer_id: 1,
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '0900',
    member_since: '2025-01-01T00:00:00.000Z',
    scope: 'ALL',
    branch_ids: null,
    total_bookings: 12,
    total_tickets: 20,
    total_spending: 1500000,
    total_combo_spending: 300000,
    favorite_genres: [
      { id: 1, name: 'Action', bookings: 8 },
      { id: 2, name: 'Comedy', bookings: 3 },
    ],
    favorite_branch: { branch_id: 2, name: 'Downtown', bookings: 7 },
    last_visit: '2026-02-01T10:00:00.000Z',
    membership_level: 'GOLD',
    membership_level_name: 'Gold',
    loyalty_points: 420,
    lifetime_points: 5200,
    ...overrides,
  };
}

describe('CustomerProfileCard', () => {
  it('renders the headline metrics and favorites', () => {
    render(<CustomerProfileCard profile={profile()} variant="staff" />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Downtown')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('hides the identity header for the self variant', () => {
    render(<CustomerProfileCard profile={profile()} variant="self" />);
    expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument();
  });

  it('omits redacted sections when the fields are absent (employee view)', () => {
    const redacted = profile();
    delete redacted.favorite_genres;
    delete redacted.total_combo_spending;
    delete redacted.lifetime_points;
    render(<CustomerProfileCard profile={redacted} variant="staff" />);
    expect(screen.queryByText('Favorite genres')).not.toBeInTheDocument();
    expect(screen.queryByText('Combo spending')).not.toBeInTheDocument();
    expect(screen.getByText('Total spending')).toBeInTheDocument();
  });

  it('shows the branch-scoped note only for BRANCH scope', () => {
    const { rerender } = render(<CustomerProfileCard profile={profile({ scope: 'ALL' })} />);
    expect(screen.queryByText(/at your branch only/i)).not.toBeInTheDocument();
    rerender(<CustomerProfileCard profile={profile({ scope: 'BRANCH', branch_ids: [2] })} />);
    expect(screen.getByText(/at your branch only/i)).toBeInTheDocument();
  });

  it('falls back to "Never" when there is no last visit', () => {
    render(<CustomerProfileCard profile={profile({ last_visit: null })} />);
    expect(screen.getByText('Never')).toBeInTheDocument();
  });
});
