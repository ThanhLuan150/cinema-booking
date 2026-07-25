import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation('common');
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <Alert variant="error">{message ?? t('feedback.somethingWrong')}</Alert>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('actions.tryAgain')}
        </Button>
      )}
    </div>
  );
}
