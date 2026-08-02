import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

const deleteMutate = vi.fn();
vi.mock('../hooks/useDeleteMovie', () => ({ useDeleteMovie: () => ({ mutateAsync: deleteMutate }) }));

import Delete from './Delete';

describe('admin movies Delete', () => {
  beforeEach(() => {
    confirmDialogMock.mockReset();
    deleteMutate.mockReset();
  });

  it('does not delete when the confirm dialog is declined', async () => {
    confirmDialogMock.mockResolvedValue(false);
    render(<Delete delete={5} />);
    fireEvent.click(screen.getByRole('button'));
    await vi.waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it('deletes the movie when confirmed', async () => {
    confirmDialogMock.mockResolvedValue(true);
    deleteMutate.mockResolvedValue({});
    render(<Delete delete={5} />);
    fireEvent.click(screen.getByRole('button'));
    await vi.waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(5));
  });
});
