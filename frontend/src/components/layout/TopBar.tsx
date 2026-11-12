import React, { useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  User,
  LogOut,
  Settings,
  X,
  Activity,
  Building2,
  Plus,
  Check,
  Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { CreateWorkspaceModal } from '@/components/organization/CreateWorkspaceModal';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    organizations,
    activeOrg,
    switchOrganization,
    userRole,
  } = useOrganization();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
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
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E5E7EB]/60 bg-white/75 px-2.5 sm:px-6 backdrop-blur-sm">
        {/* Left section: Hamburger button + Compact Mobile Branding + Multi-Tenant Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {/* Hamburger Menu Toggle */}
          <button
            onClick={onToggleSidebar}
            className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl text-dark-400 hover:bg-slate-100 hover:text-dark-100 lg:hidden transition-colors shrink-0"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Compact Mobile Branding (hidden on mobile when switcher is shown to save space) */}
          <div className="hidden sm:flex items-center gap-2 lg:hidden shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-primary-600 to-primary-500 text-white shadow-xs">
              <Activity className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-dark-100">
              DevOpsPulse
            </span>
          </div>

          {/* Multi-Tenant Workspace Switcher Dropdown */}
          <div className="relative min-w-0 shrink">
            <button
              onClick={() => {
                setWorkspaceDropdownOpen(!workspaceDropdownOpen);
                setUserDropdownOpen(false);
              }}
              className="flex h-9 sm:h-10 items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200 bg-white/90 px-2 sm:px-3 text-xs font-semibold text-dark-100 hover:border-purple-300 hover:bg-purple-50/50 transition-all shadow-2xs max-w-[125px] min-[360px]:max-w-[145px] sm:max-w-[180px]"
              title="Switch Active Organization or Personal Workspace"
            >
              {activeOrg?.type === 'COMPANY' ? (
                <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-purple-100 text-purple-700 shrink-0">
                  <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
              ) : (
                <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shrink-0">
                  <User className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
              )}
              <span className="truncate text-left text-[11px] sm:text-xs">
                {activeOrg?.name || 'My Workspace'}
              </span>
              {userRole && (
                <span className="hidden md:inline-block rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200/60 shrink-0">
                  {userRole.replace('_', ' ')}
                </span>
              )}
              <ChevronDown className="h-3 w-3 text-dark-400 shrink-0" />
            </button>

            {workspaceDropdownOpen && (
              <div
                className="absolute left-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-fade-in"
                onMouseLeave={() => setWorkspaceDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-dark-400">
                    Switch Workspace
                  </p>
                  <p className="text-xs text-dark-200">
                    Scoped database and API tenant isolation
                  </p>
                </div>

                <div className="py-1 max-h-56 overflow-y-auto space-y-0.5">
                  {organizations.map((org) => {
                    const isActive = activeOrg?.id === org.id;
                    return (
                      <button
                        key={org.id}
                        onClick={() => {
                          setWorkspaceDropdownOpen(false);
                          if (!isActive) {
                            switchOrganization(org.id);
                          }
                        }}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors ${
                          isActive
                            ? 'bg-purple-50 text-purple-900 font-bold'
                            : 'text-dark-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {org.type === 'COMPANY' ? (
                            <Building2 className="h-4 w-4 text-purple-600 shrink-0" />
                          ) : (
                            <User className="h-4 w-4 text-blue-600 shrink-0" />
                          )}
                          <div className="text-left truncate">
                            <div className="truncate">{org.name}</div>
                            <div className="text-[10px] text-dark-400 capitalize">
                              {org.type.toLowerCase()} • {org.role?.replace('_', ' ') || 'Member'}
                            </div>
                          </div>
                        </div>
                        {isActive && <Check className="h-4 w-4 text-purple-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1.5 border-t border-slate-100 space-y-1">
                  <button
                    onClick={() => {
                      setWorkspaceDropdownOpen(false);
                      setCreateModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
                  >
                    <Plus className="h-4 w-4 text-purple-600" />
                    Create New Workspace
                  </button>

                  <button
                    onClick={() => {
                      setWorkspaceDropdownOpen(false);
                      navigate('/settings/organization');
                    }}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-dark-300 hover:bg-slate-50 transition-colors"
                  >
                    <Shield className="h-3.5 w-3.5 text-dark-400" />
                    Workspace Members & Roles
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Search Bar (md+ screens) */}
          <div className="relative hidden lg:block w-64 xl:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
            <input
              type="text"
              placeholder="Search repositories, pipelines..."
              className="w-full rounded-2xl border border-[#E5E7EB] bg-slate-50/80 py-2 pl-10 pr-16 text-xs text-dark-100 placeholder-dark-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-2xs"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg border border-[#E2E8F0] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-dark-400 shadow-2xs">
              Ctrl + K
            </kbd>
          </div>
        </div>

        {/* Right section: Mobile Search Toggle, Notifications, Help, User Avatar & Dropdown */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Mobile Search Toggle Button */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl text-dark-400 hover:bg-slate-100 hover:text-dark-100 md:hidden transition-colors shrink-0"
            title="Search"
            aria-label="Toggle mobile search"
          >
            {mobileSearchOpen ? <X className="h-4.5 w-4.5" /> : <Search className="h-4.5 w-4.5" />}
          </button>

          {/* Notifications */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl text-dark-400 hover:bg-slate-100 hover:text-dark-100 transition-colors shrink-0"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            <span className="absolute top-1.5 sm:top-2.5 right-1.5 sm:right-2.5 h-2 w-2 rounded-full bg-[#7C3AED] ring-2 ring-white" />
          </button>

          {/* Help icon (hidden on small mobile screens to prevent header overflow) */}
          <button
            onClick={() => navigate('/ai/copilot')}
            className="hidden md:flex h-11 w-11 items-center justify-center rounded-xl text-dark-400 hover:bg-slate-100 hover:text-dark-100 transition-colors shrink-0"
            title="Help & Copilot"
            aria-label="Help"
          >
            <HelpCircle className="h-4.5 w-4.5" />
          </button>

          {/* User Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setWorkspaceDropdownOpen(false);
              }}
              className="flex h-9 sm:h-11 items-center gap-1 rounded-full p-0.5 sm:p-1 hover:ring-2 hover:ring-purple-500/20 transition-all shrink-0"
              aria-label="User menu"
            >
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#9333EA] text-xs font-bold text-white shadow-sm shadow-purple-500/25 shrink-0">
                {getInitials()}
              </div>
              <ChevronDown className="hidden sm:inline-block h-3.5 w-3.5 text-dark-400" />
            </button>

            {userDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-card-hover z-50 animate-fade-in"
                onMouseLeave={() => setUserDropdownOpen(false)}
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
                      setUserDropdownOpen(false);
                      navigate('/settings/organization');
                    }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 min-h-[44px] text-xs font-medium text-dark-300 hover:bg-slate-50 hover:text-dark-100 transition-colors"
                  >
                    <Building2 className="h-3.5 w-3.5 text-dark-400" />
                    Organization & RBAC
                  </button>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 min-h-[44px] text-xs font-medium text-dark-300 hover:bg-slate-50 hover:text-dark-100 transition-colors"
                  >
                    <User className="h-3.5 w-3.5 text-dark-400" />
                    Profile Settings
                  </button>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
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
                      setUserDropdownOpen(false);
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

      {/* Modal for creating a new Workspace */}
      <CreateWorkspaceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </>
  );
};

export default TopBar;
