import { describe, expect, it } from 'vitest';
import { hasFlag, hasRole, type GuardUser } from '../route-guard';

describe('route-guard', () => {
  const admin: GuardUser = { id: 'u1', roles: ['admin'], flags: { verified: true } };

  it('allows only explicit roles', () => {
    expect(hasRole(admin, ['admin'])).toBe(true);
    expect(hasRole(admin, ['editor'])).toBe(false);
    expect(hasRole({ id: 'u2' }, ['admin'])).toBe(false);
    expect(hasRole(null, ['admin'])).toBe(false);
  });

  it('treats an absent flag as denied (the !== false bug class)', () => {
    expect(hasFlag(admin, 'verified')).toBe(true);
    expect(hasFlag({ id: 'u3', flags: {} }, 'verified')).toBe(false);
    expect(hasFlag({ id: 'u4', flags: { verified: undefined } }, 'verified')).toBe(false);
    expect(hasFlag(undefined, 'verified')).toBe(false);
  });
});
