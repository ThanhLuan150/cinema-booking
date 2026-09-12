import type { GiftCardFormValues } from '../types/owner.types';

export const emptyGiftCardForm = (): GiftCardFormValues => ({
  cinema_id: '',
  code: '',
  initial_balance: '',
  currency: 'VND',
  expires_at: '',
});

export function giftCardStatusVariant(status: string) {
  if (status === 'ACTIVE') return 'success';
  if (status === 'BLOCKED' || status === 'EXPIRED') return 'warning';
  return 'default';
}
