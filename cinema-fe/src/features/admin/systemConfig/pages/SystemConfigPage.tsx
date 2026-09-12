import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { ROLES } from '@/constants/roles';
import type { SystemSettingEffective, SystemSettingSource } from '@/types/entities';
import { useSystemConfigList } from '../hooks/useSystemConfig';
import { useResetSystemConfig } from '../hooks/useSystemConfigMutations';
import { GLOBAL } from '../constants';
import { FilterBar } from '../components/FilterBar';
import { ListItem } from '../components/ListItem';
import { SettingFormModal } from '../components/SettingFormModal';

function SystemConfigPage() {
  const { t } = useTranslation('owner');
  const isAdmin = useAuthRole() === ROLES.admin;
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('systemConfig.manage');

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);

  const [selectedBranchId, setSelectedBranchId] = useState('');
  useEffect(() => {
    if (selectedBranchId) return;
    if (isAdmin) setSelectedBranchId(GLOBAL);
    else if (cinemas.length > 0) setSelectedBranchId(String(cinemas[0].id));
  }, [cinemas, selectedBranchId, isAdmin]);

  const isGlobalView = selectedBranchId === GLOBAL;
  const branchParam = isGlobalView || !selectedBranchId ? undefined : selectedBranchId;
  const currentLevelSource: SystemSettingSource = isGlobalView ? 'GLOBAL' : 'BRANCH';

  const { data, isLoading } = useSystemConfigList({ branchId: branchParam });
  const settings = data?.settings ?? [];

  const resetSetting = useResetSystemConfig();

  const [modal, setModal] = useState<SystemSettingEffective | null>(null);

  const handleReset = async (setting: SystemSettingEffective) => {
    if (!(await confirmDialog(t('systemConfig.resetConfirm', { label: setting.label })))) return;
    try {
      await resetSetting.mutateAsync({ key: setting.key, branchId: isGlobalView ? undefined : selectedBranchId });
      toast.success(t('systemConfig.resetSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AdminLayout breadcrumb={t('systemConfig.breadcrumb')} loading={isLoading}>
      <FilterBar
        cinemas={cinemas}
        isAdmin={isAdmin}
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        isGlobalView={isGlobalView}
      />

      <DataTable
        headers={[
          t('systemConfig.headers.setting'),
          t('systemConfig.headers.value'),
          t('systemConfig.headers.source'),
          t('systemConfig.headers.actions'),
        ]}
      >
        {settings.map((setting) => (
          <ListItem
            key={setting.key}
            setting={setting}
            canManage={canManage}
            isGlobalView={isGlobalView}
            currentLevelSource={currentLevelSource}
            onEdit={setModal}
            onReset={handleReset}
          />
        ))}
      </DataTable>

      {!isLoading && settings.length === 0 && <p className="mt-4 text-sm text-txt/60">{t('systemConfig.empty')}</p>}

      {modal && (
        <SettingFormModal
          setting={modal}
          isGlobalView={isGlobalView}
          selectedBranchId={selectedBranchId}
          onClose={() => setModal(null)}
        />
      )}
    </AdminLayout>
  );
}

export default SystemConfigPage;
