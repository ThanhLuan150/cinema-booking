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
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left text-white [&_td]:border-b [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
        <thead>
          <tr className="border-b border-white/20">
            {headers.map((header, index) => (
              <th key={index} className="whitespace-nowrap text-sm font-semibold">
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
