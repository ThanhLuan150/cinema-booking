import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const useAdminUserByIdMock = vi.fn();
vi.mock('@/features/admin/users/hooks/useAdminUserById', () => ({
  useAdminUserById: (...args: unknown[]) => useAdminUserByIdMock(...args),
}));

import { CustomerLabel } from './CustomerLabel';

describe('CustomerLabel', () => {
  it('falls back to the bare id while loading', () => {
    useAdminUserByIdMock.mockReturnValue({ data: undefined });
    render(<CustomerLabel customerId={42} />);
    expect(screen.getByText('#42')).toBeInTheDocument();
  });

  it('shows the customer name once resolved', () => {
    useAdminUserByIdMock.mockReturnValue({ data: { id: 42, name: 'Jane Doe', email: 'jane@example.com' } });
    render(<CustomerLabel customerId={42} />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('falls back to email when the customer has no name', () => {
    useAdminUserByIdMock.mockReturnValue({ data: { id: 42, name: '', email: 'jane@example.com' } });
    render(<CustomerLabel customerId={42} />);
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });
});
