import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { CustomerProfile } from '../types/crm.types';

export interface CustomerProfileCardProps {
  profile: CustomerProfile;
  /** `self` hides the identity header (the customer already knows who they are). */
  variant?: 'self' | 'staff';
  className?: string;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-soft p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-txt/50">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

export function CustomerProfileCard({ profile, variant = 'staff', className }: CustomerProfileCardProps) {
  const { t } = useTranslation('crm');

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {variant === 'staff' && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-white">{profile.name || t('unnamedCustomer')}</p>
            <p className="truncate text-sm text-txt/60">{profile.email}</p>
            {profile.phone && <p className="text-sm text-txt/60">{profile.phone}</p>}
          </div>
          <div className="text-right">
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-sm font-semibold text-white">
              {profile.membership_level_name}
            </span>
            <p className="mt-1 text-xs text-txt/50">
              {t('memberSince', { date: formatDate(profile.member_since) })}
            </p>
          </div>
        </div>
      )}

      {profile.scope === 'BRANCH' && (
        <p className="rounded-lg border border-border bg-surface-soft px-3 py-2 text-xs text-txt/60">
          {t('branchScopedNote')}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <Stat label={t('stats.totalBookings')} value={profile.total_bookings.toLocaleString()} />
        <Stat label={t('stats.totalTickets')} value={profile.total_tickets.toLocaleString()} />
        <Stat label={t('stats.totalSpending')} value={formatCurrency(profile.total_spending)} />
        {profile.total_combo_spending !== undefined && (
          <Stat label={t('stats.comboSpending')} value={formatCurrency(profile.total_combo_spending)} />
        )}
        <Stat label={t('stats.loyaltyPoints')} value={profile.loyalty_points.toLocaleString()} />
        {profile.lifetime_points !== undefined && (
          <Stat label={t('stats.lifetimePoints')} value={profile.lifetime_points.toLocaleString()} />
        )}
        <Stat label={t('stats.membershipLevel')} value={profile.membership_level_name} />
        <Stat
          label={t('stats.lastVisit')}
          value={profile.last_visit ? formatDate(profile.last_visit) : t('never')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-txt/60">
            {t('favoriteBranch.title')}
          </h3>
          {profile.favorite_branch ? (
            <p className="mt-2 text-white">
              <span className="font-semibold">{profile.favorite_branch.name}</span>{' '}
              <span className="text-sm text-txt/60">
                {t('favoriteBranch.count', { count: profile.favorite_branch.bookings })}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-txt/50">{t('favoriteBranch.none')}</p>
          )}
        </div>

        {profile.favorite_genres !== undefined && (
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-txt/60">
              {t('favoriteGenres.title')}
            </h3>
            {profile.favorite_genres.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {profile.favorite_genres.map((genre) => (
                  <li
                    key={genre.id}
                    className="rounded-full border border-border bg-surface-soft px-3 py-1 text-sm text-white"
                  >
                    {genre.name}
                    <span className="ml-1.5 text-xs text-txt/50">{genre.bookings}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-txt/50">{t('favoriteGenres.none')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
