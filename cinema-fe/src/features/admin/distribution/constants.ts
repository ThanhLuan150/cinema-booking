import type { DistributorForm, ReleaseForm } from './types/distribution.types';

export const emptyDistributor: DistributorForm = {
  name: '',
  code: '',
  contact_email: '',
  phone: '',
  status: 'ACTIVE',
};

export const emptyRelease: ReleaseForm = {
  movie_id: '',
  distributor_id: '',
  release_date: '',
  end_date: '',
  status: 'ACTIVE',
};
