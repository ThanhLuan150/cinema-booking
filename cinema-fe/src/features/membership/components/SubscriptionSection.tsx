import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { MomoPaymentModal } from '@/features/booking/components/MomoPaymentModal';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatCurrency, formatDate } from '@/lib/format';
import type { MyMembership, Subscription, SubscriptionPlan, SubscriptionStatus } from '../types/membership.types';
import {
  useCancelMySubscription,
  useMySubscriptions,
  usePurchaseSubscription,
  useSubscriptionPlans,
} from '../hooks/useSubscriptions';
import { BenefitsList } from './BenefitsList';

const STATUS_VARIANT: Record<SubscriptionStatus, BadgeVariant> = {
  PENDING_PAYMENT: 'warning',
  ACTIVE: 'success',
  EXPIRED: 'default',
  CANCELLED: 'outline',
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const { t } = useTranslation('membership');
  return <Badge variant={STATUS_VARIANT[status]}>{t(`subscription.status.${status}`)}</Badge>;
}

function ActiveSubscriptionCard({ subscription }: { subscription: Subscription }) {
  const { t } = useTranslation('membership');
  const limit = subscription.plan.benefits.free_tickets;
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 p-6" data-testid="active-subscription">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{subscription.plan.name}</h3>
        <SubscriptionStatusBadge status={subscription.status} />
      </div>
      {subscription.start_at && subscription.end_at && (
        <p className="mt-1 text-sm text-txt/70">
          {t('subscription.validity', { from: formatDate(subscription.start_at), to: formatDate(subscription.end_at) })}
        </p>
      )}
      {limit > 0 && (
        <div className="mt-4">
          <p className="text-sm text-txt/70">{t('subscription.ticketsUsed', { used: subscription.tickets_used, limit })}</p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, Math.round((subscription.tickets_used / Math.max(limit, 1)) * 100))}%` }}
            />
          </div>
        </div>
      )}
      <BenefitsList benefits={subscription.plan.benefits} freeTicketsPer="term" className="mt-4" />
    </div>
  );
}

function PendingSubscriptionCard({ subscription, onPay }: { subscription: Subscription; onPay: (url: string) => void }) {
  const { t } = useTranslation('membership');
  const cancelMutation = useCancelMySubscription();
  const cancel = async () => {
    if (!(await confirmDialog(t('subscription.cancelConfirm')))) return;
    try {
      await cancelMutation.mutateAsync(subscription.code);
      toast.success(t('subscription.cancelled'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6" data-testid="pending-subscription">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{subscription.plan.name}</h3>
        <SubscriptionStatusBadge status={subscription.status} />
      </div>
      <p className="mt-1 text-sm text-txt/70">{t('subscription.pendingHint', { price: formatCurrency(subscription.price) })}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {subscription.pay_url && (
          <Button type="button" onClick={() => onPay(subscription.pay_url as string)}>
            {t('subscription.continuePayment')}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={cancel} loading={cancelMutation.isPending}>
          {t('subscription.cancel')}
        </Button>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  disabled,
  loading,
  onBuy,
}: {
  plan: SubscriptionPlan;
  disabled: boolean;
  loading: boolean;
  onBuy: (plan: SubscriptionPlan) => void;
}) {
  const { t } = useTranslation('membership');
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-card">
      <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
      {plan.description && <p className="mt-1 text-sm text-txt/60">{plan.description}</p>}
      <p className="mt-4 text-2xl font-bold text-accent">{formatCurrency(plan.price)}</p>
      <p className="text-xs text-txt/50">{t('plans.duration', { days: plan.duration_days })}</p>
      <BenefitsList benefits={plan.benefits} freeTicketsPer="term" className="mt-4 flex-1" />
      <Button type="button" className="mt-6 w-full" onClick={() => onBuy(plan)} disabled={disabled} loading={loading}>
        {t('plans.buy')}
      </Button>
    </div>
  );
}

export function SubscriptionSection({ membership }: { membership: MyMembership }) {
  const { t } = useTranslation('membership');
  const { data: plans = [], isLoading: plansLoading } = useSubscriptionPlans();
  const { data: history } = useMySubscriptions({ limit: 10 });
  const purchase = usePurchaseSubscription();
  const [payUrl, setPayUrl] = useState('');
  const [buyingPlanId, setBuyingPlanId] = useState<number | null>(null);
  // One key per purchase attempt of a plan, so a double click (or a retried request) never buys twice.
  const attemptRef = useRef<{ planId: number; key: string } | null>(null);

  const { subscription, pending_subscription: pending } = membership;
  const hasOpen = Boolean(subscription || pending);

  const buy = async (plan: SubscriptionPlan) => {
    if (attemptRef.current?.planId !== plan.id) attemptRef.current = { planId: plan.id, key: crypto.randomUUID() };
    setBuyingPlanId(plan.id);
    try {
      const result = await purchase.mutateAsync({ planId: plan.id, idempotencyKey: attemptRef.current.key });
      attemptRef.current = null;
      if (result.pay_url) setPayUrl(result.pay_url);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    } finally {
      setBuyingPlanId(null);
    }
  };

  const past = (history?.data ?? []).filter((s) => s.status === 'EXPIRED' || s.status === 'CANCELLED');

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold text-white">{t('subscription.title')}</h2>

      {subscription && <ActiveSubscriptionCard subscription={subscription} />}
      {pending && <PendingSubscriptionCard subscription={pending} onPay={setPayUrl} />}

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-txt/50">{t('plans.title')}</h3>
        {plansLoading && <Spinner />}
        {!plansLoading && plans.length === 0 && <p className="text-sm text-txt/50">{t('plans.empty')}</p>}
        {hasOpen && plans.length > 0 && <p className="mb-3 text-xs text-txt/50">{t('plans.oneAtATime')}</p>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              disabled={hasOpen || (buyingPlanId !== null && buyingPlanId !== plan.id)}
              loading={buyingPlanId === plan.id}
              onBuy={buy}
            />
          ))}
        </div>
      </div>

      {past.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-txt/50">{t('subscription.history')}</h3>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {past.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="text-white">{s.plan.name}</span>
                <span className="text-txt/60">
                  {s.start_at && s.end_at ? `${formatDate(s.start_at)} – ${formatDate(s.end_at)}` : formatDate(s.createdAt)}
                </span>
                <SubscriptionStatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {payUrl && <MomoPaymentModal payUrl={payUrl} onClose={() => setPayUrl('')} />}
    </section>
  );
}
