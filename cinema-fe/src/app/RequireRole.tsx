import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/redux';
import { toast } from '@/features/notifications/toast';
import i18n from '@/i18n';
import { ROUTES } from '@/constants/routes';

export interface RequireRoleProps {
  roles: number[];
  children: ReactNode;
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const { accessToken, role: rawRole } = useAppSelector((state) => state.auth);
  if (!accessToken) {
    toast.error(i18n.t('common:auth.loginRequired'));
    return <Navigate to={ROUTES.login} replace />;
  }

  const role = Number(rawRole);
  if (!roles.includes(role)) {
    toast.error(i18n.t('common:auth.accessDenied'));
    return <Navigate to={ROUTES.home} replace />;
  }

  return <>{children}</>;
}
