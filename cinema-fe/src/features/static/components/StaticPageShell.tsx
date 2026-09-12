import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumb } from '@/components/common/Breadcrumb';

export function StaticPageShell({
  breadcrumbLabel,
  maxWidthClassName,
  children,
}: {
  breadcrumbLabel: string;
  maxWidthClassName: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <Breadcrumb items={[{ label: breadcrumbLabel }]} />

        <div className={`mx-auto w-full px-6 py-10 md:px-10 ${maxWidthClassName}`}>{children}</div>
      </div>
      <Footer />
    </div>
  );
}
