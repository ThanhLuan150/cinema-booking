import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useSaveSubscriptionPlan } from '@/features/membership/hooks/useSubscriptions';
import type { SubscriptionPlan } from '@/features/membership/types/membership.types';
import { BenefitsFields } from './BenefitsFields';
import { fromBenefitsDraft, toBenefitsDraft, type BenefitsDraft } from '../utils/benefitsDraft';

export function PlanFormModal({ plan, onClose }: { plan: SubscriptionPlan | null; onClose: () => void }) {
  const { t } = useTranslation('membership');
  const save = useSaveSubscriptionPlan();
  const [code, setCode] = useState(plan?.code ?? '');
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [price, setPrice] = useState(plan ? String(plan.price) : '');
  const [durationDays, setDurationDays] = useState(plan ? String(plan.duration_days) : '30');
  const [sortOrder, setSortOrder] = useState(plan ? String(plan.sort_order) : '0');
  const [active, setActive] = useState(plan?.active ?? true);
  const [draft, setDraft] = useState<BenefitsDraft>(() => toBenefitsDraft(plan?.benefits));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await save.mutateAsync({
        id: plan ? plan.id : null,
        payload: {
          ...(plan ? {} : { code: code.trim() }),
          name: name.trim(),
          description,
          price: Number(price),
          duration_days: Number(durationDays),
          sort_order: Number(sortOrder) || 0,
          active,
          benefits: fromBenefitsDraft(draft),
        },
      });
      toast.success(t('admin.plans.saved'));
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={plan ? t('admin.plans.edit') : t('admin.plans.new')} className="max-w-3xl">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {plan && <p className="text-xs text-txt/50">{t('admin.plans.editHint')}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id="plan-code"
            label={t('admin.fields.code')}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={Boolean(plan)}
            required
          />
          <Input id="plan-name" label={t('admin.fields.name')} value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            id="plan-price"
            type="number"
            min={1000}
            label={t('admin.fields.price')}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <Input
            id="plan-duration"
            type="number"
            min={1}
            max={366}
            label={t('admin.fields.durationDays')}
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            required
          />
          <Input
            id="plan-sort"
            type="number"
            label={t('admin.fields.sortOrder')}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-txt/90">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t('admin.fields.active')}
          </label>
        </div>
        <Textarea
          id="plan-description"
          label={t('admin.fields.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
        <BenefitsFields idPrefix="plan" draft={draft} onChange={setDraft} freeTicketsLabel={t('admin.fields.freeTicketsPlan')} />
        <div className="flex justify-end gap-2">
          <Button type="submit" loading={save.isPending}>
            {plan ? t('admin.plans.save') : t('admin.plans.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
