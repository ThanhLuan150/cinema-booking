import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

/** Phone-first shell for the in-seat pages: the customer is sitting in a dark auditorium. */
export function InSeatLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pb-16 pt-24">
        <h1 className="flex items-center gap-3 text-xl font-bold uppercase tracking-wide text-white">
          <span className="h-6 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          {title}
        </h1>
        {children}
      </main>
      <Footer />
    </div>
  );
}
