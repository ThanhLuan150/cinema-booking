import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { Footer } from './Footer';

describe('Footer', () => {
  it('renders the brand and footer sections', () => {
    render(<Footer />);
    expect(screen.getByText('brand')).toBeInTheDocument();
    expect(screen.getByText('footer.quickLink')).toBeInTheDocument();
    expect(screen.getByText('footer.contact')).toBeInTheDocument();
  });
});
