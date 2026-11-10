import React from 'react';
import { Menu, Search, Bell, ExternalLink, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const getPageTitle = (pathname: string): string => {
    if (pathname.startsWith('/dashboard')) return 'Dashboard Overview';
    if (pathname.startsWith('/repositories/')) return 'Repository Details';
    if (pathname.startsWith('/repositories')) return 'Repositories';
    if (pathname.startsWith('/workflows')) return 'CI/CD Workflows';
    if (pathname.startsWith('/deployments')) return 'Deployment History';
    if (pathname.startsWith('/notifications')) return 'Notification Center';
    if (pathname.startsWith('/settings')) return 'Settings';
    return 'DevOpsPulse';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-dark-800 bg-dark-900/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Left section: Toggle & Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-dark-400 hover:bg-dark-800 hover:text-white lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">
            {getPageTitle(location.pathname)}
          </h2>
        </div>
      </div>

      {/* Middle section: Search bar */}
      <div className="hidden md:flex items-center max-w-md flex-1 px-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            placeholder="Search repositories, workflows, commits..."
            className="w-full rounded-lg border border-dark-700/60 bg-dark-800/80 py-1.5 pl-9 pr-10 text-xs text-white placeholder-dark-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-dark-700 bg-dark-900 px-1.5 text-[10px] text-dark-400">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right section: Actions & Status */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => navigate('/notifications')}
          className="relative rounded-lg p-2 text-dark-300 hover:bg-dark-800 hover:text-white transition-colors"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 rounded-lg border border-dark-700/70 bg-dark-800/60 px-3 py-1.5 text-xs font-medium text-dark-200 hover:bg-dark-700 hover:text-white transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>GitHub</span>
        </a>

        {/* User initials / badge */}
        <div
          onClick={() => navigate('/settings')}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-primary-600 to-primary-500 text-xs font-bold text-white shadow-sm ring-2 ring-primary-500/20"
          title="Settings profile"
        >
          {user?.username ? user.username.substring(0, 2).toUpperCase() : 'DP'}
        </div>
      </div>
    </header>
  );
};
