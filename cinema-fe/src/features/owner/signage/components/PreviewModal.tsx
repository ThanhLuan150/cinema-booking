import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import type { Screen, SignageContent } from '@/types/entities';
import { useScreenPlayback } from '../hooks/useScreens';
import { DROP_LABEL } from '../constants';

interface PreviewModalProps {
  screen: Screen;
  contentById: Map<number, SignageContent>;
  onClose: () => void;
}

export function PreviewModal({ screen, contentById, onClose }: PreviewModalProps) {
  const { t } = useTranslation('owner');
  const { data, isLoading } = useScreenPlayback(screen.id);

  return (
    <Modal open onClose={onClose} title={t('signage.previewTitle', { name: screen.name })} className="max-w-2xl">
      {isLoading ? (
        <p className="text-sm text-txt/60">{t('signage.loading')}</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-txt/50">
            {t('signage.previewGeneratedAt', { time: data ? new Date(data.generated_at).toLocaleString() : '' })}
          </p>
          {!data || data.items.length === 0 ? (
            <p className="text-sm text-txt/60">{t('signage.previewEmpty')}</p>
          ) : (
            <ol className="space-y-2">
              {data.items.map((item) => (
                <li key={item.schedule_entry_id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant="default">{t(`signage.contentType.${item.type}`)}</Badge>
                  </div>
                  {item.movie && <p className="text-sm text-txt/70">{item.movie.name}</p>}
                  {item.showtime && (
                    <p className="text-sm text-txt/70">
                      {item.showtime.movie_date} {item.showtime.time_begin}–{item.showtime.time_end}
                    </p>
                  )}
                  <p className="text-xs text-txt/40">{t('signage.priorityLabel')}: {item.priority}</p>
                </li>
              ))}
            </ol>
          )}
          {data && data.dropped.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-txt/70">{t('signage.droppedTitle')}</h4>
              <ul className="mt-2 space-y-1 text-sm text-txt/60">
                {data.dropped.map((d, i) => (
                  <li key={`${d.entry_id}-${i}`}>
                    {contentById.get(d.content_id)?.title || `#${d.content_id}`} — {t(DROP_LABEL[d.code] ?? d.code)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
