import apiClient from 'services/apiClient';
import type { AdminDashboardStats } from '../types/adminDashboard.types';

export const getAdminDashboardStats = () =>
  apiClient.get<AdminDashboardStats>('/admin/dashboard').then((res) => res.data);
