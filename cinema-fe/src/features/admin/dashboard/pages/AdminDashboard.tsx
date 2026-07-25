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
      {!stats && <p className="text-white/70">{t('dashboard.loading')}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/60">{t('dashboard.stats.totalRevenue')}</p>
              <p className="text-xl font-bold text-white">{stats.totalRevenue.toLocaleString()}đ</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/60">{t('dashboard.stats.totalUsers')}</p>
              <p className="text-xl font-bold text-white">{stats.totalUsers}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/60">{t('dashboard.stats.totalOwners')}</p>
              <p className="text-xl font-bold text-white">{stats.totalOwners}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/60">{t('dashboard.stats.totalCinemas')}</p>
              <p className="text-xl font-bold text-white">{stats.totalCinemas}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/60">{t('dashboard.stats.totalTicketsSold')}</p>
              <p className="text-xl font-bold text-white">{stats.totalTicketsSold}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/60">{t('dashboard.stats.totalTransactions')}</p>
              <p className="text-xl font-bold text-white">{stats.totalTransactions}</p>
            </div>
          </div>

          <div className="mt-6 h-[320px] rounded-lg bg-white/5 p-4">
            <h6 className="mb-4 text-white">{t('dashboard.chartTitle')}</h6>
            {stats.revenueByDay.length === 0 ? (
              <EmptyState title={t('dashboard.noData')} />
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={stats.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff22" />
                  <XAxis dataKey="date" stroke="#ffffff88" fontSize={12} />
                  <YAxis stroke="#ffffff88" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#0B1A2A', border: 'none', color: '#fff' }} />
                  <Bar dataKey="total" fill="#FFC107" radius={[4, 4, 0, 0]} />
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
