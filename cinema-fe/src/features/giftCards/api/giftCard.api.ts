import apiClient from 'services/apiClient';
import type { PaginatedResponse } from '@/types/pagination';
import type { GiftCard, GiftCardTransaction } from '@/types/entities';
import type {
  GiftCardValidationResult,
  PayWithGiftCardPayload,
  PayWithGiftCardResult,
  RedeemGiftCardResult,
} from '../types/giftCard.types';

export const getMyGiftCards = (page: number, limit: number) =>
  apiClient.get<PaginatedResponse<GiftCard>>('/gift-cards/mine', { params: { page, limit } }).then((res) => res.data);

export const redeemGiftCard = (code: string) =>
  apiClient.post<RedeemGiftCardResult>('/gift-cards/redeem', { code }).then((res) => res.data);

export const validateGiftCard = (code: string, order_value: number) =>
  apiClient.post<GiftCardValidationResult>('/gift-cards/validate', { code, order_value }).then((res) => res.data);

export const payWithGiftCard = (payload: PayWithGiftCardPayload, idempotencyKey?: string) =>
  apiClient
    .post<PayWithGiftCardResult>('/gift-cards/pay', payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    })
    .then((res) => res.data);

export const getGiftCardHistory = (id: number | string, page: number, limit: number) =>
  apiClient
    .get<PaginatedResponse<GiftCardTransaction>>(`/gift-cards/${id}/history`, { params: { page, limit } })
    .then((res) => res.data);
