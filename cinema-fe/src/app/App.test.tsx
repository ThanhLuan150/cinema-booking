import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/app/router', () => ({ AppRouter: () => <div>App Router</div> }));

import { App } from './App';

describe('App', () => {
  it('renders the AppRouter', () => {
    render(<App />);
    expect(screen.getByText('App Router')).toBeInTheDocument();
  });
});
