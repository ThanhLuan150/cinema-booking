import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import type { NotificationTemplate } from '@/types/entities';
import { eventLabel } from '../constants';

export interface ListItemProps {
  template: NotificationTemplate;
  canManage: boolean;
  onEdit: (template: NotificationTemplate) => void;
  onDelete: (template: NotificationTemplate) => void;
}

export function ListItem({ template, canManage, onEdit, onDelete }: ListItemProps) {
  const { t } = useTranslation('owner');

  return (
    <tr>
      <td className="text-sm font-medium">{eventLabel(t, template.event)}</td>
      <td>
        <Badge variant="default">{template.channel}</Badge>
      </td>
      <td className="text-sm uppercase">{template.language}</td>
      <td className="max-w-xs truncate text-sm text-txt/70" title={template.subject || template.content}>
        {template.subject || template.content}
      </td>
      <td>
        <Badge variant={template.status === 'ACTIVE' ? 'success' : 'default'}>
          {t(`notificationTemplates.status.${template.status}`)}
        </Badge>
      </td>
      <td className="flex flex-wrap gap-3">
        {canManage ? (
          <>
            <button
              type="button"
              className="text-sm font-medium text-accent hover:text-accent-hover"
              onClick={() => onEdit(template)}
            >
              {t('notificationTemplates.edit')}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-red-500 hover:text-red-400"
              onClick={() => onDelete(template)}
            >
              {t('notificationTemplates.delete')}
            </button>
          </>
        ) : (
          <span className="text-sm text-txt/40">—</span>
        )}
      </td>
    </tr>
  );
}
