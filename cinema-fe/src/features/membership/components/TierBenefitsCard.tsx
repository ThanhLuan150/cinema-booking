import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import type { MyMembership } from '../types/membership.types';
import { BenefitsList } from './BenefitsList';

// What the customer's tier gives them now, what the next tier adds, and how many free tickets
// they have left this month / this term.
export function TierBenefitsCard({ membership }: { membership: MyMembership }) {
  const { t } = useTranslation('membership');
  const { level, next_level: nextLevel, free_tickets: freeTickets } = membership;

  return (
    <section className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">{t('tierBenefits.title', { level: level.name })}</h2>
          <Badge variant="gold">{level.code}</Badge>
        </div>
        <BenefitsList benefits={level.benefits} freeTicketsPer="month" className="mt-4" />
        {nextLevel && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-txt/50">
              {t('tierBenefits.next', { level: nextLevel.name })}
            </p>
            <BenefitsList benefits={nextLevel.benefits} freeTicketsPer="month" className="mt-2" />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 className="text-base font-semibold text-white">{t('freeTickets.title')}</h2>
        <p className="mt-3 text-4xl font-bold text-accent" data-testid="free-tickets-remaining">
          {freeTickets.remaining_total}
        </p>
        <p className="text-sm text-txt/60">{t('freeTickets.remainingLabel')}</p>
        <ul className="mt-4 space-y-1 text-sm text-txt/70">
          {freeTickets.subscription && (
            <li>
              {t('freeTickets.fromSubscription', {
                remaining: freeTickets.subscription.remaining,
                limit: freeTickets.subscription.limit,
              })}
            </li>
          )}
          {freeTickets.tier && (
            <li>
              {t('freeTickets.fromTier', { remaining: freeTickets.tier.remaining, limit: freeTickets.tier.limit, period: freeTickets.tier.period })}
            </li>
          )}
          {!freeTickets.subscription && !freeTickets.tier && <li>{t('freeTickets.none')}</li>}
        </ul>
        <p className="mt-4 text-xs text-txt/50">{t('freeTickets.howToUse')}</p>
      </div>
    </section>
  );
}
