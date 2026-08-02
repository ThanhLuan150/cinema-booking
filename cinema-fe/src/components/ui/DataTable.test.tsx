import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { DataTable } from './DataTable';

describe('DataTable', () => {
  it('renders headers', () => {
    render(
      <DataTable headers={['Name', 'Email']}>
        <tr>
          <td>Alice</td>
          <td>a@b.com</td>
        </tr>
      </DataTable>,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders an empty state when there are no rows', () => {
    render(<DataTable headers={['Name']}>{[]}</DataTable>);
    expect(screen.getByText('feedback.noData')).toBeInTheDocument();
  });

  it('renders a custom empty message', () => {
    render(
      <DataTable headers={['Name']} emptyMessage="Nothing here">
        {[]}
      </DataTable>,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
