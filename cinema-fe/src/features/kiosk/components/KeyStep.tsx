import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function KeyStep({
  keyInput,
  onKeyInputChange,
  busy,
  onActivate,
}: {
  keyInput: string;
  onKeyInputChange: (value: string) => void;
  busy: boolean;
  onActivate: () => void;
}) {
  const { t } = useTranslation('kiosk');
  return (
    <section className="mx-auto max-w-md">
      <h2 className="mb-2 text-lg font-semibold text-white">{t('key.title')}</h2>
      <p className="mb-4 text-sm text-txt/60">{t('key.hint')}</p>
      <Input
        id="kiosk-key"
        value={keyInput}
        onChange={(e) => onKeyInputChange(e.target.value)}
        placeholder="KIOSK-..."
      />
      <Button type="button" variant="danger" className="mt-4" loading={busy} disabled={!keyInput.trim()} onClick={onActivate}>
        {t('key.activate')}
      </Button>
    </section>
  );
}
