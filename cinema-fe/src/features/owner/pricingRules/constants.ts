import type { PricingRule } from '@/types/entities';
import type { PricingRulePayload } from '../api/owner.api';
import type { PricingRuleFormValues } from '../types/owner.types';

export const ALL_BRANCHES = 'ALL';

export function emptyRuleForm(branchId: string): PricingRuleFormValues {
  return {
    name: '',
    price: '',
    priority: '0',
    branch_id: branchId,
    room_type: '',
    seat_type: '',
    category_id: '',
    day_type: '',
    time_start: '',
    time_end: '',
    membership_level: '',
    effective_from: '',
    effective_to: '',
  };
}

export function ruleToFormValues(rule: PricingRule): PricingRuleFormValues {
  return {
    name: rule.name,
    price: String(rule.price),
    priority: String(rule.priority),
    branch_id: rule.branch_id === null ? ALL_BRANCHES : String(rule.branch_id),
    room_type: rule.room_type ?? '',
    seat_type: rule.seat_type === null ? '' : String(rule.seat_type),
    category_id: rule.category_id === null ? '' : String(rule.category_id),
    day_type: rule.day_type ?? '',
    time_start: rule.time_start ?? '',
    time_end: rule.time_end ?? '',
    membership_level: rule.membership_level ?? '',
    effective_from: rule.effective_from ?? '',
    effective_to: rule.effective_to ?? '',
  };
}

export function toRulePayload(values: PricingRuleFormValues): PricingRulePayload {
  return {
    name: values.name.trim(),
    price: Number(values.price),
    priority: values.priority === '' ? 0 : Number(values.priority),
    branch_id: values.branch_id === ALL_BRANCHES ? null : Number(values.branch_id),
    room_type: values.room_type || null,
    seat_type: values.seat_type === '' ? null : Number(values.seat_type),
    category_id: values.category_id === '' ? null : Number(values.category_id),
    day_type: values.day_type || null,
    time_start: values.time_start || null,
    time_end: values.time_end || null,
    membership_level: values.membership_level || null,
    effective_from: values.effective_from || null,
    effective_to: values.effective_to || null,
  };
}
