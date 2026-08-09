import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Select } from '@/components/ui/Select';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useMyCinemas } from '../hooks/useMyCinemas';
import { useOwnerDashboardStats } from '../hooks/useOwnerDashboardStats';
import { setSelectedbranchId } from '../store/ownerDashboardSlice';

function OwnerDashboard() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const selectedbranchId = useAppSelector((state) => state.ownerDashboard.selectedbranchId);
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data: stats } = useOwnerDashboardStats(selectedbranchId);
  const cinemaOptions = useMemo(() => cinemas.map((c) => ({ label: c.name, value: c.id })), [cinemas]);

  const bookingVersion = useAppSelector((state) => state.realtime.ownerBookingVersion);
  useEffect(() => {
    if (bookingVersion > 0) queryClient.invalidateQueries({ queryKey: ['ownerDashboardStats'] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingVersion]);

  return (
    <AdminLayout breadcrumb={t('dashboard.breadcrumb')}>
      <div className="mb-4 max-w-xs">
        <Select
          value={selectedbranchId}
          onChange={(e) => dispatch(setSelectedbranchId(e.target.value))}
          placeholder={t('dashboard.allMyCinemas')}
          options={cinemaOptions}
        />
      </div>

      {!stats && <p className="text-txt/70">{t('dashboard.loading')}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-sm text-txt/60">{t('dashboard.revenue')}</p>
              <p className="mt-1 text-2xl font-bold text-accent">{stats.revenue.toLocaleString()}đ</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-sm text-txt/60">{t('dashboard.ticketsSold')}</p>
              <p className="mt-1 text-2xl font-bold text-white">{stats.totalTicketsSold}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-sm text-txt/60">{t('dashboard.occupancyRate')}</p>
              <p className="mt-1 text-2xl font-bold text-white">{stats.occupancyRate}%</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-sm text-txt/60">{t('dashboard.scheduleCount')}</p>
              <p className="mt-1 text-2xl font-bold text-white">{stats.scheduleCount}</p>
            </div>
          </div>

          <div className="mt-6 h-[320px] rounded-xl border border-border bg-surface p-4 shadow-card">
            <h6 className="mb-4 font-semibold text-white">{t('dashboard.revenueByDay')}</h6>
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

export default OwnerDashboard;
