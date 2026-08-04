import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { Footer } from './Footer';

describe('Footer', () => {
  it('renders the brand and footer sections', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Footer />
      </MemoryRouter>,
    );
    expect(screen.getByText('brand')).toBeInTheDocument();
    expect(screen.getByText('footer.quickLink')).toBeInTheDocument();
    expect(screen.getByText('footer.contact')).toBeInTheDocument();
  });
});
