import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import type { User } from '@/types/entities';
import { useCustomerSearch } from '../hooks/useCustomerSearch';

export interface CustomerPickerProps {
  selected: User | null;
  onSelect: (user: User | null) => void;
}

// Search-by-name/email/phone combo box for picking a customer account (needs the user.read
// permission on the backend). Shared by the booking search workbench and the support ticket
// creation form.
export function CustomerPicker({ selected, onSelect }: CustomerPickerProps) {
  const { t } = useTranslation('customerService');
  const [query, setQuery] = useState('');
  const { data } = useCustomerSearch(query);
  const results = data?.data ?? [];

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm">
        <span>
          {selected.name || t('customerPicker.noName')} · {selected.email}
        </span>
        <button type="button" className="text-xs font-medium text-accent" onClick={() => onSelect(null)}>
          {t('customerPicker.change')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <Input
        label={t('customerPicker.label')}
        placeholder={t('customerPicker.placeholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                onClick={() => onSelect(user)}
              >
                {user.name || t('customerPicker.noName')} · {user.email}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && results.length === 0 && <p className="mt-1 text-xs text-txt/50">{t('customerPicker.noResults')}</p>}
    </div>
  );
}
