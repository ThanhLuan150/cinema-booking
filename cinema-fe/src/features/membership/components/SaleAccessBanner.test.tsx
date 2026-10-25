import '@/i18n';
import i18n from '@/i18n';
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const useSaleAccessMock = vi.fn();
vi.mock('../hooks/useSubscriptions', () => ({ useSaleAccess: (id: number | null) => useSaleAccessMock(id) }));

import { SaleAccessBanner } from './SaleAccessBanner';

describe('SaleAccessBanner (Priority Booking)', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });
  beforeEach(() => {
    useSaleAccessMock.mockReset();
  });

  it('says nothing for a showtime already on sale to everyone', () => {
    useSaleAccessMock.mockReturnValue({ data: { open: true, priority: false, opens_at: null, general_opens_at: null } });
    const { container } = render(<SaleAccessBanner scheduleId={7} />);
    expect(container).toBeEmptyDOMElement();
    expect(useSaleAccessMock).toHaveBeenCalledWith(7);
  });

  it('tells a customer when the sale opens, and when it opens for them', () => {
    useSaleAccessMock.mockReturnValue({
      data: { open: false, priority: false, opens_at: '2026-11-01T01:00:00.000Z', general_opens_at: '2026-11-01T03:00:00.000Z' },
    });
    render(<SaleAccessBanner scheduleId={7} />);
    const banner = screen.getByTestId('sale-not-open');
    expect(banner).toHaveTextContent('go on sale');
    expect(banner).toHaveTextContent('You can book from');
  });

  it('tells a member they are booking early', () => {
    useSaleAccessMock.mockReturnValue({ data: { open: true, priority: true, opens_at: null, general_opens_at: '2026-11-01T03:00:00.000Z' } });
    render(<SaleAccessBanner scheduleId={7} />);
    expect(screen.getByTestId('sale-priority')).toHaveTextContent('Priority Booking');
  });
});
