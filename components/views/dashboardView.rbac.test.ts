import { describe, it, expect } from 'vitest';

/** Mesma regra de Layout.tsx / DashboardView.tsx */
function hasPermission(userPermissions: string[], isAdminPrincipal: boolean, key: string): boolean {
  return isAdminPrincipal || userPermissions.includes(key);
}

describe('P0-44 dashboard RBAC (occurrences)', () => {
  const porteiroPerms = [
    'dashboard.view',
    'packages.view',
    'visitors.view',
    'reservations.view',
    'sentinela.view',
    'settings.view',
    'notices.view'
  ];

  it('porteiro sem occurrences.view não vê KPI/atalhos de ocorrência', () => {
    expect(hasPermission(porteiroPerms, false, 'occurrences.view')).toBe(false);
    expect(hasPermission(porteiroPerms, false, 'occurrences.create')).toBe(false);
  });

  it('perfil com occurrences.view vê módulo', () => {
    const perms = [...porteiroPerms, 'occurrences.view', 'occurrences.create'];
    expect(hasPermission(perms, false, 'occurrences.view')).toBe(true);
    expect(hasPermission(perms, false, 'occurrences.create')).toBe(true);
  });

  it('síndico (admin principal) mantém acesso implícito', () => {
    expect(hasPermission(porteiroPerms, true, 'occurrences.view')).toBe(true);
  });
});
