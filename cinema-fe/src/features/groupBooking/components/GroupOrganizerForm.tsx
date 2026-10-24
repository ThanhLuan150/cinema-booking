import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { GroupOrganizer, OrganizerType } from '../types/groupBooking.types';

const ORGANIZER_TYPES: OrganizerType[] = ['CUSTOMER', 'COMPANY'];

/** Who the group booking is for: a private group, or a company (name + tax code for its invoice). */
export function GroupOrganizerForm({
  organizer,
  errors,
  showErrors,
  onChange,
}: {
  organizer: GroupOrganizer;
  errors: Partial<Record<keyof GroupOrganizer, string>>;
  showErrors: boolean;
  onChange: (next: GroupOrganizer) => void;
}) {
  const { t } = useTranslation('groupBooking');
  const set = (field: keyof GroupOrganizer) => (event: { target: { value: string } }) =>
    onChange({ ...organizer, [field]: event.target.value });
  const errorOf = (field: keyof GroupOrganizer) => (showErrors && errors[field] ? t(errors[field] as string) : undefined);
  const isCompany = organizer.organizer_type === 'COMPANY';

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
      <h2 className="mb-4 flex items-center gap-3 text-base font-bold uppercase tracking-wide text-white">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        {t('organizer.title')}
      </h2>
      <div role="radiogroup" aria-label={t('organizer.typeLabel')} className="mb-4 grid grid-cols-2 gap-2">
        {ORGANIZER_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={organizer.organizer_type === type}
            onClick={() => onChange({ ...organizer, organizer_type: type })}
            className={cn(
              'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
              organizer.organizer_type === type
                ? 'border-accent bg-accent/15 text-white'
                : 'border-border-strong text-txt/70 hover:border-accent/60',
            )}
          >
            <i className={cn('fa-solid mr-2', type === 'COMPANY' ? 'fa-building' : 'fa-users')} aria-hidden="true" />
            {t(`organizer.type.${type}`)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input id="group_name" label={t('organizer.groupName')} value={organizer.group_name} onChange={set('group_name')} maxLength={120} />
        {isCompany && (
          <>
            <Input
              id="company_name"
              label={t('organizer.companyName')}
              value={organizer.company_name}
              onChange={set('company_name')}
              error={errorOf('company_name')}
              maxLength={200}
            />
            <Input
              id="tax_code"
              label={t('organizer.taxCode')}
              placeholder="0101234567"
              value={organizer.tax_code}
              onChange={set('tax_code')}
              error={errorOf('tax_code')}
              maxLength={20}
            />
          </>
        )}
        <Input id="contact_name" label={t('organizer.contactName')} value={organizer.contact_name} onChange={set('contact_name')} maxLength={120} />
        <Input
          id="contact_phone"
          label={t('organizer.contactPhone')}
          value={organizer.contact_phone}
          onChange={set('contact_phone')}
          error={errorOf('contact_phone')}
          maxLength={20}
        />
        <Input
          id="contact_email"
          type="email"
          label={t('organizer.contactEmail')}
          value={organizer.contact_email}
          onChange={set('contact_email')}
          error={errorOf('contact_email')}
          maxLength={200}
        />
      </div>
      <div className="mt-3">
        <Textarea id="group_note" label={t('organizer.note')} rows={2} value={organizer.note} onChange={set('note')} maxLength={500} />
      </div>
    </div>
  );
}
