import type { HolidayFormValues } from '../types/owner.types';

export const ALL_BRANCHES = 'ALL';

export function emptyHolidayForm(branchId: string): HolidayFormValues {
  return { date: '', name: '', branch_id: branchId };
}
