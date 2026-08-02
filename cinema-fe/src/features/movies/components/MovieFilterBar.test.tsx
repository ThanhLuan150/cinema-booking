import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useCategoriesMock = vi.fn();
vi.mock('../hooks/useCategories', () => ({ useCategories: () => useCategoriesMock() }));

const useCinemasListMock = vi.fn();
vi.mock('../hooks/useCinemasList', () => ({ useCinemasList: () => useCinemasListMock() }));

vi.mock('./FavoriteCinemaButton', () => ({ FavoriteCinemaButton: () => <button>Fav</button> }));

import { MovieFilterBar } from './MovieFilterBar';

describe('MovieFilterBar', () => {
  beforeEach(() => {
    useCategoriesMock.mockReturnValue({ data: [{ id: 1, name: 'Action' }] });
    useCinemasListMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
  });

  it('calls onChange with the updated search text', () => {
    const onChange = vi.fn();
    render(<MovieFilterBar filters={{}} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('filterBar.searchPlaceholder'), { target: { value: 'matrix' } });
    expect(onChange).toHaveBeenCalledWith({ search: 'matrix' });
  });

  it('shows the favorite button only when a cinema filter is set', () => {
    const { rerender } = render(<MovieFilterBar filters={{}} onChange={() => {}} />);
    expect(screen.queryByText('Fav')).not.toBeInTheDocument();
    rerender(<MovieFilterBar filters={{ cinema: '1' } as any} onChange={() => {}} />);
    expect(screen.getByText('Fav')).toBeInTheDocument();
  });
});
