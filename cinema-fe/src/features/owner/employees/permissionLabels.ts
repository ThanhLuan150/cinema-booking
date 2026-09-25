import type { PositionPermissionGrant } from '@/types/entities';

export interface GrantGroup {
  module: string;
  actions: string[];
}

// "ticket.checkin" -> { module: 'ticket', action: 'checkin' }; "combo.order.view" -> action
// "order_view" (dots are i18n key separators, so they are flattened for the lookup).
function splitCode(code: string) {
  const [module, ...rest] = code.split('.');
  const action = rest.join('_');
  // "view" and "read" mean the same thing to the person picking a Position.
  return { module, action: action === 'view' ? 'read' : action };
}

// Groups a Position's raw permission codes by module so the UI can say "Tickets: View, Check in"
// instead of listing developer-facing codes. Grants keep the order the backend sends (sorted by
// code), so modules and their actions come out stable.
export function groupGrants(grants: PositionPermissionGrant[]): GrantGroup[] {
  const groups = new Map<string, string[]>();
  for (const { code } of grants) {
    const { module, action } = splitCode(code);
    const actions = groups.get(module) ?? [];
    if (action && !actions.includes(action)) actions.push(action);
    groups.set(module, actions);
  }
  return [...groups].map(([module, actions]) => ({ module, actions }));
}
