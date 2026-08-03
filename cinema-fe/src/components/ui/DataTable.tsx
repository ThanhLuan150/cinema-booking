import { Children, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/feedback/EmptyState';

export interface DataTableProps {
  headers: ReactNode[];
  children: ReactNode;
  emptyMessage?: string;
}

export function DataTable({ headers, children, emptyMessage }: DataTableProps) {
  const { t } = useTranslation('common');
  const isEmpty = Children.count(children) === 0;

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm text-txt [&_td]:border-b [&_td]:border-border [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-2.5 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-white/[0.03]">
        <thead>
          <tr className="bg-surface-raised">
            {headers.map((header, index) => (
              <th
                key={index}
                className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-txt/60"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={headers.length}>
                <EmptyState title={emptyMessage ?? t('feedback.noData')} />
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
