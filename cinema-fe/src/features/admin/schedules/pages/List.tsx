import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { useSchedules } from '../hooks/useSchedules';

const List = () => {
  const { t } = useTranslation('admin');
  const { data: schedules = [] } = useSchedules();

  return (
    <AdminLayout breadcrumb={t('schedules.list.breadcrumb')}>
      <DataTable headers={t('schedules.list.headers', { returnObjects: true }) as unknown as string[]}>
        {schedules.map((schedule) => (
          <tr key={schedule.id}>
            <td>{schedule.id}</td>
            <td>{schedule.movie_id}</td>
            <td>{schedule.time_begin}</td>
            <td>{schedule.time_end}</td>
            <td>{schedule.movie_date}</td>
            <td>{schedule.price}</td>
          </tr>
        ))}
      </DataTable>
    </AdminLayout>
  );
};
export default List;
