import { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-txt">
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="text-sm text-txt/70">{description}</p>}
      {action}
    </div>
  );
}
