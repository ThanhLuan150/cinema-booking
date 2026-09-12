import type { SupportTicketCategory } from '@/types/entities';

export interface CreateSupportTicketPayload {
  branch_id: number;
  customer_id: number;
  category?: SupportTicketCategory;
  subject: string;
  description?: string;
}

export interface CreateTicketFormValues {
  subject: string;
  description: string;
  category: SupportTicketCategory;
}
