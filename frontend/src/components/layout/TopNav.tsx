import { LogOut, Menu, Bell, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib';
import { useAuth } from '@/contexts';

interface TopNavProps {
  onMenuClick: () => void;
  isCollapsed: boolean;
}

export function TopNav({ onMenuClick, isCollapsed: _isCollapsed }: TopNavProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'User';
  const role = user?.roles?.[0]?.replace(/_/g, ' ') ?? 'Staff';
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : 'U';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 sm:px-6 transition-all duration-300',
        'lg:ml-0'
      )}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="hidden sm:flex flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all duration-200"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-3 ml-2">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{displayName}</p>
            <p className="text-xs text-[var(--color-text-muted)] capitalize">{role.toLowerCase()}</p>
          </div>
          <div className="h-9 w-9 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white font-medium text-sm">
            {initials}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
