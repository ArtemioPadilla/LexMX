import * as React from 'react';

/**
 * Route-guard + role-gating scaffold (Inceptor #182): the ONLY gating module.
 *
 * Hard rules (CLAUDE.md § "Auth gating rules"):
 *  - Permission checks are explicit allowlists / `=== true`. NEVER `!== false`:
 *    an ABSENT field passes `!== false`, silently granting access.
 *  - Identity always comes from the auth context ($guardUser), never from
 *    props defaults, query params or placeholder literals.
 *  - Deny by default: no user, unknown role, or missing flag ⇒ blocked.
 */
export interface GuardUser {
  /** Stable user id from the provider, never a hardcoded placeholder. */
  id: string;
  /** Roles granted by the backend (app_metadata). Absent/empty ⇒ no role-gated access. */
  roles?: readonly string[];
  /** Boolean capability flags. Only an explicit `true` grants. */
  flags?: Readonly<Record<string, boolean | undefined>>;
}

export function hasRole(user: GuardUser | null | undefined, allow: readonly string[]): boolean {
  if (!user || !user.roles || user.roles.length === 0) return false;
  return user.roles.some((r) => allow.includes(r));
}

export function hasFlag(user: GuardUser | null | undefined, flag: string): boolean {
  return user?.flags?.[flag] === true;
}

export interface RouteGuardProps {
  user: GuardUser | null | undefined;
  allow: readonly string[];
  requireFlags?: readonly string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RouteGuard({ user, allow, requireFlags = [], fallback = null, children }: RouteGuardProps): React.ReactNode {
  const roleOk = hasRole(user, allow);
  const flagsOk = requireFlags.every((f) => hasFlag(user, f));
  if (!roleOk || !flagsOk) return fallback;
  return children;
}
