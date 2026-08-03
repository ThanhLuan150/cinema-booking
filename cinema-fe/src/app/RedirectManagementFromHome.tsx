import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/redux';
import { ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';

export interface RedirectManagementFromHomeProps {
  children: ReactNode;
}

export function RedirectManagementFromHome({ children }: RedirectManagementFromHomeProps) {
  const { accessToken, role: rawRole } = useAppSelector((state) => state.auth);
  const role = Number(rawRole);

  if (accessToken && role === ROLES.admin) {
    return <Navigate to={ROUTES.adminDashboard} replace />;
  }
  if (accessToken && role === ROLES.owner) {
    return <Navigate to={ROUTES.ownerDashboard} replace />;
  }

  return <>{children}</>;
}
