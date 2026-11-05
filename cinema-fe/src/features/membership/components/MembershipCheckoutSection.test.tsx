import '@/i18n';
import i18n from '@/i18n';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MembershipCheckoutSection } from './MembershipCheckoutSection';
import type { MembershipPreview } from '../types/membership.types';

function preview(membership: Partial<MembershipPreview['membership']> = {}): MembershipPreview {
  return {
    seat_total: 220000,
    combo_total: 30000,
    order_value: 250000,
    membership: {
      level: 'GOLD',
      subscription_id: 9,
      free_tickets: { requested: 0, applied: 0, available: 2 },
      covered_ticket_ids: [],
      free_ticket_amount: 0,
      ticket_discount_percent: 10,
      ticket_discount_amount: 22000,
      fnb_discount_percent: 10,
      fnb_discount_amount: 3000,
      total: 25000,
      ...membership,
    },
    value_after_membership: 225000,
    code_discount: 0,
    total_price: 225000,
    sale: { open: true, priority: false, opens_at: null, general_opens_at: null },
  };
}

describe('MembershipCheckoutSection', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('shows nothing for a customer with no benefits on this order', () => {
    const { container } = render(
      <MembershipCheckoutSection
        preview={preview({ total: 0, ticket_discount_amount: 0, fnb_discount_amount: 0, free_tickets: { requested: 0, applied: 0, available: 0 } })}
        freeTickets={0}
        onChangeFreeTickets={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(render(<MembershipCheckoutSection preview={undefined} freeTickets={0} onChangeFreeTickets={vi.fn()} />).container).toBeEmptyDOMElement();
  });

  it('lists the server-computed member discounts', () => {
    render(<MembershipCheckoutSection preview={preview()} freeTickets={0} onChangeFreeTickets={vi.fn()} />);
    expect(screen.getByText('GOLD member')).toBeInTheDocument();
    expect(screen.getByText('Member ticket discount (10%)')).toBeInTheDocument();
    expect(screen.getByText('-22,000đ')).toBeInTheDocument();
    expect(screen.getByText('-3,000đ')).toBeInTheDocument();
  });

  it('lets the customer choose how many free tickets to use, within what is available', () => {
    const onChange = vi.fn();
    const { rerender } = render(<MembershipCheckoutSection preview={preview()} freeTickets={0} onChangeFreeTickets={onChange} />);
    expect(screen.getByText('2 available for this order')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use one less free ticket' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Use one more free ticket' }));
    expect(onChange).toHaveBeenCalledWith(1);

    rerender(
      <MembershipCheckoutSection
        preview={preview({ free_tickets: { requested: 2, applied: 2, available: 2 }, free_ticket_amount: 220000 })}
        freeTickets={2}
        onChangeFreeTickets={onChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'Use one more free ticket' })).toBeDisabled();
    expect(screen.getByText('Free tickets (2)')).toBeInTheDocument();
    expect(screen.getByText('-220,000đ')).toBeInTheDocument();
  });
});
