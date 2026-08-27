import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

const useCustomerSearchMock = vi.fn();
vi.mock('../hooks/useCustomerSearch', () => ({
  useCustomerSearch: (...args: unknown[]) => useCustomerSearchMock(...args),
}));

import { CustomerPicker } from './CustomerPicker';

const customer = { id: 1, name: 'Jane Doe', email: 'jane@example.com', phone: '', role: 1, status: 1, approved: true };

describe('CustomerPicker', () => {
  beforeEach(() => useCustomerSearchMock.mockReset());

  it('shows the selected customer and a change action', () => {
    useCustomerSearchMock.mockReturnValue({ data: undefined });
    const onSelect = vi.fn();
    render(<CustomerPicker selected={customer} onSelect={onSelect} />);
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('customerPicker.change'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders search results and selects one on click', () => {
    useCustomerSearchMock.mockReturnValue({ data: { data: [customer] } });
    const onSelect = vi.fn();
    render(<CustomerPicker selected={null} onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText('customerPicker.placeholder'), { target: { value: 'jane' } });
    fireEvent.click(screen.getByText(/Jane Doe/));
    expect(onSelect).toHaveBeenCalledWith(customer);
  });

  it('shows a no-results message when the search returns nothing', () => {
    useCustomerSearchMock.mockReturnValue({ data: { data: [] } });
    render(<CustomerPicker selected={null} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('customerPicker.placeholder'), { target: { value: 'nobody' } });
    expect(screen.getByText('customerPicker.noResults')).toBeInTheDocument();
  });
});
