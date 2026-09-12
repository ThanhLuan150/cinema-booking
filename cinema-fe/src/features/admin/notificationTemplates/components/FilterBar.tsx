import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type {
  NotificationTemplateChannel,
  NotificationTemplateEvent,
  NotificationTemplateStatus,
} from '@/types/entities';
import type { NotificationTemplateFilters } from '../api/notificationTemplates.api';
import { eventLabel } from '../constants';

export interface FilterBarProps {
  filters: NotificationTemplateFilters;
  onFilterChange: (patch: Partial<NotificationTemplateFilters>) => void;
  onReset: () => void;
  events: string[];
  supportedChannels: string[];
  languages: string[];
  statuses: string[];
  canManage: boolean;
  onAddClick: () => void;
}

export function FilterBar({
  filters,
  onFilterChange,
  onReset,
  events,
  supportedChannels,
  languages,
  statuses,
  canManage,
  onAddClick,
}: FilterBarProps) {
  const { t } = useTranslation('owner');

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="max-w-xs flex-1">
        <Select
          id="tmpl-filter-event"
          label={t('notificationTemplates.filters.event')}
          value={filters.event}
          onChange={(e) => onFilterChange({ event: e.target.value as NotificationTemplateEvent | '' })}
          placeholder={t('notificationTemplates.filters.any')}
          options={events.map((ev) => ({ label: eventLabel(t, ev), value: ev }))}
        />
      </div>
      <div className="max-w-[12rem] flex-1">
        <Select
          id="tmpl-filter-channel"
          label={t('notificationTemplates.filters.channel')}
          value={filters.channel}
          onChange={(e) => onFilterChange({ channel: e.target.value as NotificationTemplateChannel | '' })}
          placeholder={t('notificationTemplates.filters.any')}
          options={supportedChannels.map((c) => ({ label: c, value: c }))}
        />
      </div>
      <div className="max-w-[10rem] flex-1">
        <Select
          id="tmpl-filter-language"
          label={t('notificationTemplates.filters.language')}
          value={filters.language}
          onChange={(e) => onFilterChange({ language: e.target.value })}
          placeholder={t('notificationTemplates.filters.any')}
          options={languages.map((l) => ({ label: l.toUpperCase(), value: l }))}
        />
      </div>
      <div className="max-w-[10rem] flex-1">
        <Select
          id="tmpl-filter-status"
          label={t('notificationTemplates.filters.status')}
          value={filters.status}
          onChange={(e) => onFilterChange({ status: e.target.value as NotificationTemplateStatus | '' })}
          placeholder={t('notificationTemplates.filters.any')}
          options={statuses.map((s) => ({ label: t(`notificationTemplates.status.${s}`), value: s }))}
        />
      </div>
      <Button type="button" variant="outline" onClick={onReset}>
        {t('notificationTemplates.filters.reset')}
      </Button>
      {canManage && (
        <Button type="button" variant="danger" onClick={onAddClick}>
          {t('notificationTemplates.addButton')}
        </Button>
      )}
    </div>
  );
}
