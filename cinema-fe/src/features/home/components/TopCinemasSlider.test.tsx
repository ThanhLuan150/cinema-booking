import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useTopCinemasMock = vi.fn();
vi.mock('@/features/movies/hooks/useTopCinemas', () => ({ useTopCinemas: () => useTopCinemasMock() }));

import TopCinemas from './TopCinemasSlider';

describe('TopCinemasSlider', () => {
  beforeEach(() => useTopCinemasMock.mockReset());

  it('renders nothing when there are no cinemas', () => {
    useTopCinemasMock.mockReturnValue({ data: [] });
    const { container } = render(<TopCinemas />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a cinema card with rating and booking count', () => {
    useTopCinemasMock.mockReturnValue({
      data: [{ id: 1, name: 'Cinema A', address: 'Addr', city: 'HN', avgRating: 4.5, bookingCount: 10, images: [] }],
    });
    render(<TopCinemas />);
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });
});
