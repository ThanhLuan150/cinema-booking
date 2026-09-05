import type { GiftCard, GiftCardTransaction } from '@/types/entities';

export type { GiftCard, GiftCardTransaction };

export type RedeemGiftCardResult = GiftCard;

export interface GiftCardValidationResult {
  code: string;
  remaining_balance: number;
  currency: string;
  applicable_amount: number;
}

export interface PayWithGiftCardPayload {
  code: string;
  ticketIds: number[];
  comboIds?: number[];
}

export interface PayWithGiftCardResult {
  bookingId: number;
  code: string;
  totalPrice: number;
  alreadyProcessed: boolean;
}
