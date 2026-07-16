import type { AuthenticatedUser } from '../../middleware/auth';

/**
 * Check if user can view financial reports (ADMIN, MANAGER).
 */
export function canViewFinancialReports(user: AuthenticatedUser | undefined): boolean {
  if (!user) return false;
  return user.roles.some((r) => r === 'ADMIN' || r === 'MANAGER');
}

/**
 * Check if user can view inventory costs (ADMIN, MANAGER, STOCK_KEEPER).
 */
export function canViewInventoryCosts(user: AuthenticatedUser | undefined): boolean {
  if (!user) return false;
  return user.roles.some((r) => r === 'ADMIN' || r === 'MANAGER' || r === 'STOCK_KEEPER');
}

/**
 * Check if user can view payment references and sensitive data (ADMIN, MANAGER).
 */
export function canViewSensitivePaymentData(user: AuthenticatedUser | undefined): boolean {
  if (!user) return false;
  return user.roles.some((r) => r === 'ADMIN' || r === 'MANAGER');
}

/**
 * Check if user can view waiter performance reports (ADMIN, MANAGER).
 */
export function canViewWaiterReports(user: AuthenticatedUser | undefined): boolean {
  if (!user) return false;
  return user.roles.some((r) => r === 'ADMIN' || r === 'MANAGER');
}

/**
 * Check if user can view cashier performance reports (ADMIN, MANAGER).
 */
export function canViewCashierReports(user: AuthenticatedUser | undefined): boolean {
  if (!user) return false;
  return user.roles.some((r) => r === 'ADMIN' || r === 'MANAGER');
}

/**
 * Check if user can export reports (ADMIN, MANAGER can export all;
 * CASHIER can export limited).
 */
export function canExportReports(user: AuthenticatedUser | undefined): boolean {
  if (!user) return false;
  return user.roles.some((r) => r === 'ADMIN' || r === 'MANAGER' || r === 'CASHIER');
}

/**
 * Get the report roles for a user. ADMIN and MANAGER see everything.
 * WAITER sees only their own data.
 */
export function getReportScope(user: AuthenticatedUser | undefined): 'full' | 'own' | 'limited' {
  if (!user) return 'own';
  if (user.roles.includes('ADMIN') || user.roles.includes('MANAGER')) return 'full';
  if (user.roles.includes('CASHIER')) return 'limited';
  return 'own';
}
