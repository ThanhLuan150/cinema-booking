import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { SignageContent } from '@/types/entities';

interface ContentLibraryPanelProps {
  contents: SignageContent[];
  canManage: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onEdit: (content: SignageContent) => void;
  onDelete: (content: SignageContent) => void;
}

export function ContentLibraryPanel({ contents, canManage, canAdd, onAdd, onEdit, onDelete }: ContentLibraryPanelProps) {
  const { t } = useTranslation('owner');

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-txt/60">{t('signage.contentTitle')}</h3>
        {canManage && canAdd && (
          <Button type="button" size="sm" variant="secondary" onClick={onAdd}>
            {t('signage.addContent')}
          </Button>
        )}
      </div>
      {contents.length === 0 ? (
        <p className="text-sm text-txt/60">{t('signage.noContent')}</p>
      ) : (
        <DataTable
          headers={[
            t('signage.contentHeaders.title'),
            t('signage.contentHeaders.type'),
            t('signage.contentHeaders.status'),
            t('signage.contentHeaders.actions'),
          ]}
        >
          {contents.map((c) => (
            <tr key={c.id}>
              <td>{c.title}</td>
              <td>{t(`signage.contentType.${c.type}`)}</td>
              <td>
                <Badge variant={c.status === 'ACTIVE' ? 'success' : 'default'}>
                  {t(`signage.contentStatusLabel.${c.status}`)}
                </Badge>
              </td>
              <td className="flex flex-wrap gap-3">
                {canManage && (
                  <>
                    <button
                      type="button"
                      className="text-sm font-medium text-accent hover:text-accent-hover"
                      onClick={() => onEdit(c)}
                    >
                      {t('signage.edit')}
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-red-500 hover:text-red-400"
                      onClick={() => onDelete(c)}
                    >
                      {t('signage.delete')}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
