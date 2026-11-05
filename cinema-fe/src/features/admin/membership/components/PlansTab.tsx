import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/format';
import { BenefitsList } from '@/features/membership/components/BenefitsList';
import { useAllSubscriptionPlans, useDeleteSubscriptionPlan } from '@/features/membership/hooks/useSubscriptions';
import type { SubscriptionPlan } from '@/features/membership/types/membership.types';
import { PlanFormModal } from './PlanFormModal';

export function PlansTab() {
  const { t } = useTranslation('membership');
  const { data: plans = [], isLoading } = useAllSubscriptionPlans();
  const remove = useDeleteSubscriptionPlan();
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [open, setOpen] = useState(false);

  const openForm = (plan: SubscriptionPlan | null) => {
    setEditing(plan);
    setOpen(true);
  };

  const onDelete = async (plan: SubscriptionPlan) => {
    if (!(await confirmDialog(t('admin.plans.deleteConfirm', { name: plan.name })))) return;
    try {
      await remove.mutateAsync(plan.id);
      toast.success(t('admin.plans.deleted'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  if (isLoading) return <Spinner />;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={() => openForm(null)}>
          {t('admin.plans.new')}
        </Button>
      </div>
      <DataTable
        headers={[
          t('admin.fields.code'),
          t('admin.fields.name'),
          t('admin.fields.price'),
          t('admin.fields.durationDays'),
          t('admin.fields.freeTickets'),
          t('admin.subscriptions.status'),
          t('admin.subscriptions.actions'),
        ]}
        emptyMessage={t('admin.plans.empty')}
      >
        {plans.map((plan) => (
          <tr key={plan.id}>
            <td className="font-mono text-xs">{plan.code}</td>
            <td>
              <p className="font-medium text-white">{plan.name}</p>
              <BenefitsList benefits={plan.benefits} freeTicketsPer="term" className="mt-1 text-xs" />
            </td>
            <td>{formatCurrency(plan.price)}</td>
            <td>{plan.duration_days}</td>
            <td>{plan.benefits.free_tickets}</td>
            <td>
              <Badge variant={plan.active ? 'success' : 'outline'}>
                {plan.active ? t('admin.plans.onSale') : t('admin.plans.retired')}
              </Badge>
            </td>
            <td>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => openForm(plan)}>
                  {t('admin.plans.edit')}
                </Button>
                <Button type="button" size="sm" variant="danger" onClick={() => onDelete(plan)}>
                  {t('admin.plans.delete')}
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      {open && <PlanFormModal plan={editing} onClose={() => setOpen(false)} />}
    </>
  );
}
