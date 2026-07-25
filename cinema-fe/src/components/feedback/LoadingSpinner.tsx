import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';

export interface LoadingSpinnerProps {
  label?: string;
}

export function LoadingSpinner({ label }: LoadingSpinnerProps) {
  const { t } = useTranslation('common');
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-txt">
      <Spinner size="lg" />
      <span className="text-sm text-txt/70">{label ?? t('actions.loading')}</span>
    </div>
  );
}
