import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useMembershipLevels } from '@/features/membership/hooks/useMembershipLevels';
import { useUpdateTierBenefits } from '@/features/membership/hooks/useSubscriptions';
import type { MembershipLevel } from '@/features/membership/types/membership.types';
import { BenefitsFields } from './BenefitsFields';
import { fromBenefitsDraft, toBenefitsDraft, type BenefitsDraft } from '../utils/benefitsDraft';

function TierCard({ level }: { level: MembershipLevel }) {
  const { t } = useTranslation('membership');
  const [minPoints, setMinPoints] = useState(String(level.min_points));
  const [draft, setDraft] = useState<BenefitsDraft>(() => toBenefitsDraft(level.benefits));
  const update = useUpdateTierBenefits();

  const save = async () => {
    try {
      await update.mutateAsync({ id: level.id, min_points: Number(minPoints), benefits: fromBenefitsDraft(draft) });
      toast.success(t('admin.tiers.saved', { level: level.name }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5" data-testid={`tier-${level.code}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-white">{level.name}</h3>
          <Badge variant="gold">{level.code}</Badge>
          {!level.active && <Badge variant="outline">{t('admin.plans.retired')}</Badge>}
        </div>
        <div className="w-56">
          <Input
            id={`tier-${level.code}-min-points`}
            type="number"
            min={0}
            label={t('admin.fields.minPoints')}
            value={minPoints}
            onChange={(e) => setMinPoints(e.target.value)}
          />
        </div>
      </div>
      <BenefitsFields
        idPrefix={`tier-${level.code}`}
        draft={draft}
        onChange={setDraft}
        freeTicketsLabel={t('admin.fields.freeTicketsTier')}
      />
      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={save} loading={update.isPending}>
          {t('admin.tiers.save')}
        </Button>
      </div>
    </div>
  );
}

export function TiersTab() {
  const { t } = useTranslation('membership');
  const { data: levels = [], isLoading } = useMembershipLevels();
  if (isLoading) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-txt/60">{t('admin.tiers.hint')}</p>
      {levels.map((level) => (
        <TierCard key={`${level.id}-${level.min_points}`} level={level} />
      ))}
    </div>
  );
}
