import apiClient from 'services/apiClient';
import type { CustomerProfile } from '../types/crm.types';

export const getMyCrmProfile = () =>
  apiClient.get<CustomerProfile>('/crm/me').then((res) => res.data);

export const getCustomerCrmProfile = (accountId: number | string) =>
  apiClient.get<CustomerProfile>(`/crm/customers/${accountId}`).then((res) => res.data);
