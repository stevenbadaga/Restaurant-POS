export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  appName: 'Restaurant POS',
  version: '1.0.0',
} as const;

export const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Tables', path: '/tables', icon: 'Grid3x3' },
  { label: 'Orders', path: '/orders', icon: 'ClipboardList' },
  { label: 'Kitchen', path: '/kitchen', icon: 'ChefHat' },
  { label: 'Menu', path: '/menu', icon: 'BookOpen' },
  { label: 'Inventory', path: '/inventory', icon: 'Package' },
  { label: 'Payments', path: '/payments', icon: 'CreditCard' },
  { label: 'Receipts', path: '/receipts', icon: 'Receipt' },
  { label: 'Staff', path: '/staff', icon: 'Users' },
  { label: 'Reports', path: '/reports', icon: 'BarChart3' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
] as const;
