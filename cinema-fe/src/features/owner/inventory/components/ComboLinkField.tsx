import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import { useComboComponents } from '../../hooks/useComboComponents';

interface ComboLinkFieldProps {
  cinemaId: string;
  value: string;
  onChange: (value: string) => void;
}

// Optionally links this record to a branch's own FOOD/BEVERAGE combo item, so a paid sale of
// that item (directly or bundled in a COMBO) auto-deducts this record.
export function ComboLinkField({ cinemaId, value, onChange }: ComboLinkFieldProps) {
  const { t } = useTranslation('owner');
  const { data } = useComboComponents(cinemaId || undefined);
  const components = (data?.data ?? []).filter((combo) => combo.type !== 'COMBO');

  if (!cinemaId) {
    return <p className="mt-3 text-sm text-txt/60">{t('inventory.comboSelectCinemaFirst')}</p>;
  }

  return (
    <div className="mt-3">
      <Select
        label={t('inventory.comboLabel')}
        value={value}
        placeholder={t('inventory.comboPlaceholder')}
        options={components.map((component) => ({ label: component.name, value: component.id }))}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-1.5 text-xs text-txt/50">{t('inventory.comboHint')}</p>
    </div>
  );
}
