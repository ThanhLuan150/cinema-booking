import { useAdminUserById } from '@/features/admin/users/hooks/useAdminUserById';

// Resolves a customer_id to a display name/email (needs user.read). Falls back to the bare id
// while loading or if the lookup fails/isn't permitted.
export function CustomerLabel({ customerId }: { customerId: number }) {
  const { data } = useAdminUserById(customerId);
  return <span>{data ? data.name || data.email : `#${customerId}`}</span>;
}
