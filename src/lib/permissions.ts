import type { User } from './api';

/** Returns true if the current user can access a given feature/permission */
export function can(user: User | null, permission: string): boolean {
  if (!user) return false;
  if (user.accountType === 'owner' || user.role === 'owner') return true;
  if (!user.permissions) return false;
  const perms = user.permissions as unknown as Record<string, unknown>;
  return perms[permission] === true;
}

/** True only for shop owners */
export function isOwner(user: User | null): boolean {
  return user?.accountType === 'owner' || user?.role === 'owner';
}
