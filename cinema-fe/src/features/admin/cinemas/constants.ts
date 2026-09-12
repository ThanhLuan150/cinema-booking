import type { CreateBranchAdminPayload } from './types/cinemas.types';

export const emptyBranchAdminForm = (): CreateBranchAdminPayload => ({
  email: '',
  password: '',
  name: '',
  phone: '',
  cinema_name: '',
  code: '',
  address: '',
  city: '',
});
