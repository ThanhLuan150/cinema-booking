export type Tab = 'releases' | 'distributors';

export interface DistributorForm {
  name: string;
  code: string;
  contact_email: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ReleaseForm {
  movie_id: string;
  distributor_id: string;
  release_date: string;
  end_date: string;
  status: 'ACTIVE' | 'INACTIVE';
}
