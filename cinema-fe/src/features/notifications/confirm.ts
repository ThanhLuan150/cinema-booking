import { store } from '@/app/store';
import { openConfirm, closeConfirm } from './confirmSlice';
import type { ConfirmOptions } from './types/confirm.types';

let nextId = 1;
const resolvers = new Map<number, (value: boolean) => void>();

// Drop-in replacement for window.confirm(): returns a Promise<boolean> resolved once
// the user picks an option on the custom <ConfirmDialog />, so call sites just do
// `if (!(await confirmDialog('...'))) return;` instead of the blocking native dialog.
export function confirmDialog(message: string, options?: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const id = nextId++;
    resolvers.set(id, resolve);
    store.dispatch(openConfirm({ id, message, ...options }));
  });
}

export function resolveConfirm(id: number, result: boolean) {
  const resolve = resolvers.get(id);
  if (resolve) {
    resolve(result);
    resolvers.delete(id);
  }
  store.dispatch(closeConfirm());
}
