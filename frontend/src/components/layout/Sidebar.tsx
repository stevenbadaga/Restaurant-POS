import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Grid3x3,
  Bell,
  ShieldCheck,
  ClipboardList,
  ClipboardCheck,
  QrCode,
  ChefHat,
  BookOpen,
  Package,
  CreditCard,
  Receipt,
  Users,
  BarChart3,
  Settings,
  Clock,
  CalendarDays,
  ListChecks,
  UserCheck,
  DollarSign,
  MessageSquare,
  X,
  Moon,
  Sun,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib';
import { useTheme } from '@/contexts/ThemeContext';

const mainNav = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'Approvals', path: '/approvals', icon: ShieldCheck },
  { label: 'My Shift', path: '/my-shift', icon: Clock },
  { label: 'Tables', path: '/tables', icon: Grid3x3 },
  { label: 'QR Codes', path: '/tables/qr-codes', icon: QrCode },
  { label: 'Orders', path: '/orders', icon: ClipboardList },
  { label: 'Kitchen', path: '/kitchen', icon: ChefHat },
];

const managementNav = [
  { label: 'Menu', path: '/menu', icon: BookOpen },
  { label: 'Inventory', path: '/inventory', icon: Package },
  { label: 'Waiting List', path: '/waiting-list', icon: ListChecks },
  { label: 'Payments', path: '/payments', icon: CreditCard },
  { label: 'Tips & Pooling', path: '/tips', icon: DollarSign },
  { label: 'Receipts', path: '/receipts', icon: Receipt },
];

const workforceNav = [
  { label: 'Shifts', path: '/shifts', icon: CalendarDays },
  { label: 'Attendance', path: '/attendance', icon: UserCheck },
  { label: 'Cashier Sessions', path: '/cashier-sessions', icon: DollarSign },
  { label: 'Handovers', path: '/handovers', icon: MessageSquare },
];

const systemNav = [
  { label: 'Staff', path: '/staff', icon: Users },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
  { label: 'Setup Checklist', path: '/settings/setup-checklist', icon: ClipboardCheck },
  { label: 'Settings', path: '/settings', icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo area */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-accent)]">
            <span className="text-white font-display font-bold text-lg">P</span>
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="text-sm font-display font-bold text-[var(--color-text-primary)]">
                Restaurant POS
              </h2>
              <p className="text-[10px] text-[var(--color-text-muted)]">Management System</p>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Main navigation */}
        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {!isCollapsed && 'Operations'}
        </p>
        {mainNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'sidebar-link',
                isActive && 'active',
                isCollapsed && 'justify-center px-2'
              )
            }
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {/* Management */}
        <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {!isCollapsed && 'Management'}
        </p>
        {managementNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'sidebar-link',
                isActive && 'active',
                isCollapsed && 'justify-center px-2'
              )
            }
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {/* Workforce */}
        <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {!isCollapsed && 'Workforce'}
        </p>
        {workforceNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'sidebar-link',
                isActive && 'active',
                isCollapsed && 'justify-center px-2'
              )
            }
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {/* System */}
        <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {!isCollapsed && 'System'}
        </p>
        {systemNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'sidebar-link',
                isActive && 'active',
                isCollapsed && 'justify-center px-2'
              )
            }
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom area */}
      <div className="border-t border-[var(--color-border)] p-3 space-y-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'sidebar-link w-full',
            isCollapsed && 'justify-center px-2'
          )}
          title={isCollapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5 shrink-0" />
          ) : (
            <Moon className="h-5 w-5 shrink-0" />
          )}
          {!isCollapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>

        {/* Collapse toggle - desktop only */}
        <button
          onClick={onToggleCollapse}
          className="sidebar-link w-full justify-center px-2 hidden lg:flex"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={cn(
              'h-5 w-5 shrink-0 transition-transform duration-200',
              isCollapsed && 'rotate-180'
            )}
          />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border)] transform transition-transform duration-300 ease-in-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border)] transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
