import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Select } from '@/components/ui/Select';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useMyCinemas } from '../hooks/useMyCinemas';
import { useOwnerDashboardStats } from '../hooks/useOwnerDashboardStats';
import { setSelectedCinemaId } from '../store/ownerDashboardSlice';

function OwnerDashboard() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const selectedCinemaId = useAppSelector((state) => state.ownerDashboard.selectedCinemaId);
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = cinemasPage?.data ?? [];
  const { data: stats } = useOwnerDashboardStats(selectedCinemaId);

  const bookingVersion = useAppSelector((state) => state.realtime.ownerBookingVersion);
  useEffect(() => {
    if (bookingVersion > 0) queryClient.invalidateQueries({ queryKey: ['ownerDashboardStats'] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingVersion]);

  return (
    <AdminLayout breadcrumb={t('dashboard.breadcrumb')}>
      <div className="mb-4">
        <Select
          value={selectedCinemaId}
          onChange={(e) => dispatch(setSelectedCinemaId(e.target.value))}
          placeholder={t('dashboard.allMyCinemas')}
          options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
          className="bg-white"
        />
      </div>

      {!stats && <p className="text-white/70">{t('dashboard.loading')}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/60">{t('dashboard.revenue')}</p>
              <p className="text-2xl font-bold text-white">{stats.revenue.toLocaleString()}đ</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/60">{t('dashboard.ticketsSold')}</p>
              <p className="text-2xl font-bold text-white">{stats.totalTicketsSold}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/60">{t('dashboard.occupancyRate')}</p>
              <p className="text-2xl font-bold text-white">{stats.occupancyRate}%</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/60">{t('dashboard.scheduleCount')}</p>
              <p className="text-2xl font-bold text-white">{stats.scheduleCount}</p>
            </div>
          </div>

          <div className="mt-6 h-[320px] rounded-lg bg-white/5 p-4">
            <h6 className="mb-4 text-white">{t('dashboard.revenueByDay')}</h6>
            {stats.revenueByDay.length === 0 ? (
              <EmptyState title={t('dashboard.noData')} />
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={stats.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff22" />
                  <XAxis dataKey="date" stroke="#ffffff88" fontSize={12} />
                  <YAxis stroke="#ffffff88" fontSize={12} />
                  <Tooltip contentStyle={{ background: '#0B1A2A', border: 'none', color: '#fff' }} />
                  <Bar dataKey="total" fill="#E00813" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}

export default OwnerDashboard;
