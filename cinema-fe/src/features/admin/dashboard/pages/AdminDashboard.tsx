import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useAdminDashboardStats } from '../hooks/useAdminDashboardStats';

function AdminDashboard() {
  const { t } = useTranslation('admin');
  const { data: stats } = useAdminDashboardStats();

  return (
    <AdminLayout breadcrumb={t('dashboard.breadcrumb')}>
      {!stats && <p className="text-txt/70">{t('dashboard.loading')}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-sm text-txt/60">{t('dashboard.stats.totalRevenue')}</p>
              <p className="mt-1 text-xl font-bold text-accent">{stats.totalRevenue.toLocaleString()}đ</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-sm text-txt/60">{t('dashboard.stats.totalUsers')}</p>
              <p className="mt-1 text-xl font-bold text-white">{stats.totalUsers}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-sm text-txt/60">{t('dashboard.stats.totalOwners')}</p>
              <p className="mt-1 text-xl font-bold text-white">{stats.totalOwners}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-sm text-txt/60">{t('dashboard.stats.totalCinemas')}</p>
              <p className="mt-1 text-xl font-bold text-white">{stats.totalCinemas}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-sm text-txt/60">{t('dashboard.stats.totalTicketsSold')}</p>
              <p className="mt-1 text-xl font-bold text-white">{stats.totalTicketsSold}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-sm text-txt/60">{t('dashboard.stats.totalTransactions')}</p>
              <p className="mt-1 text-xl font-bold text-white">{stats.totalTransactions}</p>
            </div>
          </div>

          <div className="mt-6 h-[320px] rounded-xl border border-border bg-surface p-4 shadow-card">
            <h6 className="mb-4 font-semibold text-white">{t('dashboard.chartTitle')}</h6>
            {stats.revenueByDay.length === 0 ? (
              <EmptyState title={t('dashboard.noData')} />
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={stats.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                  <XAxis dataKey="date" stroke="#A9B4C0" fontSize={12} />
                  <YAxis stroke="#A9B4C0" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: '#17293C', border: '1px solid rgba(245,245,220,0.16)', borderRadius: 8, color: '#F5F5DC' }}
                  />
                  <Bar dataKey="total" fill="#C1121F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}

export default AdminDashboard;
