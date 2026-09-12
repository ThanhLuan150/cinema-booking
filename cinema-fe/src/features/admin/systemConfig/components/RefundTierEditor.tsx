import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { RefundPolicyTier } from '@/types/entities';

export interface RefundTierEditorProps {
  tiers: RefundPolicyTier[];
  onChange: (tiers: RefundPolicyTier[]) => void;
}

export function RefundTierEditor({ tiers, onChange }: RefundTierEditorProps) {
  const { t } = useTranslation('owner');
  const updateTier = (index: number, patch: Partial<RefundPolicyTier>) => {
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  };
  const removeTier = (index: number) => onChange(tiers.filter((_, i) => i !== index));
  const addTier = () => onChange([...tiers, { minHours: 0, percent: 0 }]);

  return (
    <div className="space-y-2">
      {tiers.map((tier, index) => (
        <div key={index} className="flex items-end gap-2">
          <Input
            type="number"
            min={0}
            label={index === 0 ? t('systemConfig.form.minHours') : undefined}
            value={tier.minHours}
            onChange={(e) => updateTier(index, { minHours: Number(e.target.value) })}
          />
          <Input
            type="number"
            min={0}
            max={100}
            label={index === 0 ? t('systemConfig.form.percent') : undefined}
            value={tier.percent}
            onChange={(e) => updateTier(index, { percent: Number(e.target.value) })}
          />
          <Button type="button" variant="outline" onClick={() => removeTier(index)}>
            {t('systemConfig.form.removeTier')}
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addTier}>
        {t('systemConfig.form.addTier')}
      </Button>
    </div>
  );
}
