import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const changeLanguage = vi.fn();
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage },
    }),
  };
});

import { LanguageSwitcher } from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('shows the current language selected', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole('button')).toHaveTextContent('English');
  });

  it('changes the language when a new option is picked', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Tiếng Việt'));
    expect(changeLanguage).toHaveBeenCalledWith('vi');
  });
});
