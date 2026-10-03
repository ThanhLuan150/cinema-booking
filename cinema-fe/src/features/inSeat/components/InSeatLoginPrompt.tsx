import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { loginPathReturningTo } from '@/features/auth/utils/nextPath';
import { InSeatLayout } from './InSeatLayout';

/** Ordering to a seat needs the account that holds its ticket; after signing in, come straight back. */
export function InSeatLoginPrompt() {
  const { t } = useTranslation('inSeat');
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <InSeatLayout title={t('pageTitle')}>
      <section className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-lg font-semibold text-white">{t('login.title')}</h2>
        <p className="text-sm text-txt/70">{t('login.body')}</p>
        <Button
          type="button"
          onClick={() => navigate(loginPathReturningTo(`${location.pathname}${location.search}`))}
        >
          {t('login.action')}
        </Button>
      </section>
    </InSeatLayout>
  );
}
