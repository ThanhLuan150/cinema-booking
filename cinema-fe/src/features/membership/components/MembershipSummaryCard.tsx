import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import type { MembershipSummary } from '../types/membership.types';

export function MembershipSummaryCard({
  summary,
  onRedeemClick,
}: {
  summary: MembershipSummary;
  onRedeemClick: () => void;
}) {
  const { t } = useTranslation('membership');

  // Progress toward the next tier's threshold, measured from zero lifetime points (we don't
  // know the current tier's own threshold from the summary, so this is "how far into the next
  // tier's requirement" rather than "how far between tiers" — simple and still informative).
  const progressPercent = summary.next_level
    ? Math.min(
        100,
        Math.round(
          ((summary.next_level.min_points - summary.points_to_next_level) /
            Math.max(summary.next_level.min_points, 1)) *
            100,
        ),
      )
    : 100;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="block text-xs font-medium uppercase tracking-wide text-txt/50">
            {t('currentTierLabel')}
          </span>
          <span className="mt-1 inline-block rounded-full bg-accent px-3 py-1 text-lg font-semibold text-white">
            {summary.membership_level_name}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-xs font-medium uppercase tracking-wide text-txt/50">
            {t('pointsBalanceLabel')}
          </span>
          <span className="mt-1 block text-2xl font-bold text-white">
            {summary.points_balance.toLocaleString()}
          </span>
        </div>
        <Button type="button" onClick={onRedeemClick} disabled={summary.points_balance <= 0}>
          {t('redeem.button')}
        </Button>
      </div>

      {summary.next_level ? (
        <div className="mt-6">
          <p className="text-xs text-txt/60">{t('progressToNext', { level: summary.next_level.name })}</p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-txt/60">
            {t('pointsToNext', {
              points: summary.points_to_next_level.toLocaleString(),
              level: summary.next_level.name,
            })}
          </p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-txt/60">{t('topTierReached')}</p>
      )}

      <p className="mt-4 text-xs text-txt/50">
        {t('lifetimePointsLabel', { points: summary.lifetime_points.toLocaleString() })}
      </p>
    </div>
  );
}
