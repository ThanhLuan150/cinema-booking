import { createContext, useContext } from 'react';

export interface AdminShellValue {
  footerEl: HTMLElement | null;
}

export const AdminShellContext = createContext<AdminShellValue | null>(null);

export function useAdminShell() {
  return useContext(AdminShellContext);
}
