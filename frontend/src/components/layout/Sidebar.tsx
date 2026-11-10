import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GitFork,
  GitBranch,
  Rocket,
  Bell,
  Settings,
  LogOut,
  Activity,
  ChevronRight,
  Shield,
  Gauge,
  Server,
  Boxes,
  Cloud,
  Terminal,
  Sparkles,
  Code2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { notificationService } from '@/services/notifications';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { data } = await notificationService.getUnreadCount();
        setUnreadCount(data.unread_count || 0);
      } catch {
        // Ignore unread count failure in background
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Repositories', path: '/repositories', icon: GitFork },
    { name: 'Workflows', path: '/workflows', icon: GitBranch },
    { name: 'Deployments', path: '/deployments', icon: Rocket },
    { name: 'DORA Velocity', path: '/dora', icon: Gauge },
    { name: 'Uptime Monitor', path: '/uptime', icon: Activity },
    { name: 'Security Hub', path: '/security', icon: Shield },
    { name: 'Docker Containers', path: '/infrastructure/docker', icon: Server },
    { name: 'Kubernetes', path: '/infrastructure/kubernetes', icon: Boxes },
    { name: 'Cloud Telemetry', path: '/infrastructure/cloud', icon: Cloud },
    { name: 'Logs & Tracing', path: '/observability/telemetry', icon: Terminal },
    { name: 'AI Copilot & RCA', path: '/ai/copilot', icon: Sparkles },
    { name: 'AI Code Reviewer', path: '/ai/code-intelligence', icon: Code2 },
    {
      name: 'Notifications',
      path: '/notifications',
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-dark-800 bg-dark-900 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-3 border-b border-dark-800 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary-600 to-primary-400 text-white shadow-lg shadow-primary-500/20">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">DevOpsPulse</h1>
            <p className="text-xs text-dark-400">CI/CD Monitor</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-dark-400">
            Platform
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                      : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-500 px-1.5 text-xs font-semibold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout Footer */}
        <div className="border-t border-dark-800 p-4">
          <div className="flex items-center justify-between rounded-lg bg-dark-800/60 p-2.5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-900/60 text-primary-300 font-semibold border border-primary-700/50">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  (user?.username?.[0] || 'U').toUpperCase()
                )}
              </div>
              <div className="overflow-hidden">
                <p className="truncate text-xs font-semibold text-white">
                  {user?.full_name || user?.username}
                </p>
                <p className="truncate text-[10px] text-dark-400">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="rounded-md p-1.5 text-dark-400 hover:bg-dark-700 hover:text-danger-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
