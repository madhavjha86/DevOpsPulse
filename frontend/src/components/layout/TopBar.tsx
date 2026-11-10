import React, { useState } from 'react';
import { Menu, Search, Bell, HelpCircle, ChevronDown, User, LogOut, Settings, X, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const getInitials = () => {
    if (user?.full_name && !user.full_name.includes('System')) {
      const parts = user.full_name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return user.full_name.substring(0, 2).toUpperCase();
    }
    return 'MJ';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E5E7EB]/60 bg-white/75 px-3 sm:px-6 backdrop-blur-sm">
      {/* Left section: Hamburger button + Compact Mobile Branding */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hamburger Menu Toggle (Touch-friendly 44px min-target) */}
        <button
          onClick={onToggleSidebar}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-dark-400 hover:bg-slate-100 hover:text-dark-100 lg:hidden transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Compact Mobile Branding (visible only on mobile when sidebar is closed) */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-primary-600 to-primary-500 text-white shadow-xs">
            <Activity className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold tracking-tight text-dark-100 hidden min-[360px]:inline">
            DevOpsPulse
          </span>
        </div>

        {/* Desktop Search Bar (md+ screens) */}
        <div className="relative hidden md:block w-72 sm:w-80 lg:w-96">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            placeholder="Search repositories, pipelines, or incidents..."
            className="w-full rounded-2xl border border-[#E5E7EB] bg-slate-50/80 py-2 pl-10 pr-16 text-xs text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-2xs"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg border border-[#E2E8F0] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-dark-400 shadow-2xs">
            Ctrl + K
          </kbd>
        </div>
      </div>

      {/* Right section: Mobile Search Toggle, Notifications, Help, User Avatar & Dropdown */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Mobile Search Toggle Button (Touch-friendly 44px target) */}
        <button
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-dark-400 hover:bg-slate-100 hover:text-dark-100 md:hidden transition-colors"
          title="Search"
          aria-label="Toggle mobile search"
        >
          {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </button>

        {/* Notifications (Touch-friendly 44px target) */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative flex h-11 w-11 items-center justify-center rounded-xl text-dark-400 hover:bg-slate-100 hover:text-dark-100 transition-colors"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#7C3AED] ring-2 ring-white" />
        </button>

        {/* Help icon (Touch-friendly 44px target) */}
        <button
          onClick={() => navigate('/ai/copilot')}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-dark-400 hover:bg-slate-100 hover:text-dark-100 transition-colors"
          title="Help & Copilot"
          aria-label="Help"
        >
          <HelpCircle className="h-4.5 w-4.5" />
        </button>

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex h-11 items-center gap-1.5 rounded-full p-1 hover:ring-2 hover:ring-purple-500/20 transition-all"
            aria-label="User menu"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#9333EA] text-xs font-bold text-white shadow-sm shadow-purple-500/25">
              {getInitials()}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-dark-400" />
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-card-hover z-50 animate-fade-in"
              onMouseLeave={() => setDropdownOpen(false)}
            >
              <div className="px-3 py-2 border-b border-[#F1F5F9]">
                <p className="text-xs font-bold text-dark-100 truncate">
                  {user?.full_name?.includes('System') ? 'Madhav Jha' : (user?.full_name || 'Madhav Jha')}
                </p>
                <p className="text-[11px] font-medium text-dark-400 truncate">
                  {user?.email || 'admin@devopspulse.com'}
                </p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 min-h-[44px] text-xs font-medium text-dark-300 hover:bg-slate-50 hover:text-dark-100 transition-colors"
                >
                  <User className="h-3.5 w-3.5 text-dark-400" />
                  Profile Settings
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 min-h-[44px] text-xs font-medium text-dark-300 hover:bg-slate-50 hover:text-dark-100 transition-colors"
                >
                  <Settings className="h-3.5 w-3.5 text-dark-400" />
                  Preferences
                </button>
              </div>

              <div className="pt-1 border-t border-[#F1F5F9]">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 min-h-[44px] text-xs font-medium text-danger-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5 text-danger-500" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Mobile Search Drawer/Bar */}
      {mobileSearchOpen && (
        <div className="absolute top-16 left-0 right-0 z-40 border-b border-[#E5E7EB] bg-white p-3 shadow-md md:hidden animate-slide-up">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search repositories, pipelines, or incidents..."
              className="w-full rounded-xl border border-[#E5E7EB] bg-slate-50 py-2.5 pl-10 pr-10 text-xs text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <button
              onClick={() => setMobileSearchOpen(false)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-100 p-1"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default TopBar;
