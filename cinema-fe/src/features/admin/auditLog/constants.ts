import type { FilterState } from './types/auditLog.types';

export const ALL_BRANCHES = 'ALL';

export const emptyFilters: FilterState = { entityType: '', action: '', performedBy: '', from: '', to: '' };
