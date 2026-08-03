import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const saveCinemaInfoMock = vi.fn();
vi.mock('../api/auth.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth.api')>();
  return { ...actual, saveCinemaInfo: (...args: unknown[]) => saveCinemaInfoMock(...args) };
});

import CinemaInfoPage from './CinemaInfoPage';

function renderPage(path = '/CinemaInfo?email=owner@b.com') {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/CinemaInfo" element={<CinemaInfoPage />} />
          <Route path="/Login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CinemaInfoPage', () => {
  beforeEach(() => saveCinemaInfoMock.mockReset());

  it('renders the form', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Cinema Information' })).toBeInTheDocument();
  });

  it('saves the info and navigates to login on success', async () => {
    saveCinemaInfoMock.mockResolvedValue({ data: {} });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText("Type your cinema's name"), { target: { value: 'Galaxy' } });
    fireEvent.change(screen.getByPlaceholderText('Type your phone number'), { target: { value: '0123456789' } });
    fireEvent.change(screen.getByPlaceholderText("Type the cinema's address"), { target: { value: '123 St' } });
    fireEvent.change(screen.getByPlaceholderText('Type the city'), { target: { value: 'Hanoi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(saveCinemaInfoMock).toHaveBeenCalledTimes(1);
    const formData = saveCinemaInfoMock.mock.calls[0][0] as FormData;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('email')).toBe('owner@b.com');
    expect(formData.get('name')).toBe('Galaxy');
    expect(formData.get('phone')).toBe('0123456789');
    expect(formData.get('address')).toBe('123 St');
    expect(formData.get('city')).toBe('Hanoi');
  });
});
