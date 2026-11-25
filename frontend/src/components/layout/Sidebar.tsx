import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  BarChart2,
  Sparkles,
  FolderGit2,
  GitBranch,
  Layers,
  Activity,
  AlertTriangle,
  FileText,
  Settings,
  ChevronDown,
  Boxes,
  Cloud,
  Server,
  X,
  Users,
  DollarSign,
  ShieldAlert,
  Terminal,
  Building2,
  Compass,
  ShieldCheck,
  RefreshCw,
  Coins,
  GitMerge,
  Lock,
  Brain,
  FileCode,
  Bell,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavChild {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPrefixes: string[];
  children: NavChild[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  const navGroups: NavGroup[] = [
    {
      id: 'ai',
      name: 'AI & Intelligence',
      icon: Sparkles,
      matchPrefixes: ['/ai'],
      children: [
        { name: 'AI Copilot', path: '/ai/copilot', icon: Sparkles },
        { name: 'Root Cause (RCA)', path: '/ai/rca', icon: Brain },
        { name: 'Code Intelligence', path: '/ai/code-intelligence', icon: FileCode },
        { name: 'AI Governance', path: '/ai/governance', icon: Coins },
      ],
    },
    {
      id: 'cicd',
      name: 'CI/CD & Delivery',
      icon: GitBranch,
      matchPrefixes: ['/workflows', '/deployments', '/gitops', '/repositories', '/developer-portal'],
      children: [
        { name: 'PulseCI Pipelines', path: '/workflows', icon: GitBranch },
        { name: 'Deployments', path: '/deployments', icon: FileText },
        { name: 'GitOps & Canary', path: '/gitops', icon: GitMerge },
        { name: 'Repositories', path: '/repositories', icon: FolderGit2 },
        { name: 'Developer Portal', path: '/developer-portal', icon: Compass },
      ],
    },
    {
      id: 'monitoring',
      name: 'Observability & SRE',
      icon: Activity,
      matchPrefixes: ['/observability', '/uptime', '/incidents', '/dora', '/analytics'],
      children: [
        { name: 'Telemetry & Grafana', path: '/observability/telemetry', icon: Activity },
        { name: 'Uptime & Monitors', path: '/uptime', icon: AlertTriangle },
        { name: 'Incident Control', path: '/incidents', icon: ShieldAlert },
        { name: 'DORA Metrics', path: '/dora', icon: BarChart2 },
        { name: 'Team Productivity', path: '/analytics/team-productivity', icon: Users },
      ],
    },
    {
      id: 'infrastructure',
      name: 'Infrastructure & Cloud',
      icon: Layers,
      matchPrefixes: ['/infrastructure', '/terminal'],
      children: [
        { name: 'Docker Containers', path: '/infrastructure/docker', icon: Server },
        { name: 'Kubernetes Clusters', path: '/infrastructure/kubernetes', icon: Boxes },
        { name: 'Web Terminal', path: '/infrastructure/terminal', icon: Terminal },
        { name: 'Cloud Canvas (IaC)', path: '/infrastructure/canvas', icon: Layers },
        { name: 'Cloud Telemetry', path: '/infrastructure/cloud', icon: Cloud },
        { name: 'FinOps & Cost', path: '/infrastructure/cost', icon: DollarSign },
      ],
    },
    {
      id: 'security',
      name: 'Security & Vault',
      icon: ShieldCheck,
      matchPrefixes: ['/security', '/secrets', '/disaster-recovery'],
      children: [
        { name: 'Security & SBOM', path: '/security', icon: ShieldCheck },
        { name: 'Zero-Trust Vault', path: '/security/vault', icon: Lock },
        { name: 'Disaster Recovery', path: '/disaster-recovery', icon: RefreshCw },
      ],
    },
    {
      id: 'admin',
      name: 'Workspace & Settings',
      icon: Settings,
      matchPrefixes: ['/settings', '/notifications'],
      children: [
        { name: 'Organization', path: '/settings/organization', icon: Building2 },
        { name: 'Notifications', path: '/notifications', icon: Bell },
        { name: 'Platform Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

  // Initialize open groups: whichever group matches current location is open by default
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      ai: false,
      cicd: false,
      monitoring: false,
      infrastructure: false,
      security: false,
      admin: false,
    };
    for (const group of navGroups) {
      if (group.matchPrefixes.some((prefix) => location.pathname.startsWith(prefix))) {
        initial[group.id] = true;
      }
    }
    return initial;
  });

  // Keep active group auto-expanded on navigation
  useEffect(() => {
    for (const group of navGroups) {
      if (group.matchPrefixes.some((prefix) => location.pathname.startsWith(prefix))) {
        setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
      }
    }
  }, [location.pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const isGroupActive = (group: NavGroup) =>
    group.matchPrefixes.some((prefix) => location.pathname.startsWith(prefix));

  return (
    <>
      {/* Mobile Backdrop Overlay (Closes drawer on tap) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container (Persistent on lg: 1024px+, Slide-in Drawer on mobile/tablet) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 sm:w-64 flex-col border-r border-[#E5E7EB] bg-white transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
        aria-label="Sidebar navigation"
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#E5E7EB] px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#6D28D9] text-white shadow-md shadow-purple-500/25">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-dark-100">DevOpsPulse</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#7C3AED] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
              v1.1.0
            </span>
            {/* Close button for mobile touch */}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-dark-400 hover:bg-slate-100 hover:text-dark-100 lg:hidden transition-colors"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3.5 py-4">
          {/* Primary Standalone Overview Item: Dashboard */}
          <NavLink
            to="/dashboard"
            end
            onClick={onClose}
            className={({ isActive }) =>
              `group flex items-center justify-between rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs sm:text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-[#EDE9FE] text-[#7C3AED] font-bold shadow-2xs'
                  : 'text-dark-300 hover:bg-slate-50 hover:text-dark-100'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <Home className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-105" />
              <span>Dashboard</span>
            </div>
          </NavLink>

          {/* Categorized Expandable Accordion Groups */}
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const isGroupOpen = !!openGroups[group.id];
            const groupActive = isGroupActive(group);

            return (
              <div key={group.id} className="pt-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isGroupOpen}
                  className={`w-full group flex items-center justify-between rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs sm:text-sm font-medium transition-all duration-150 ${
                    groupActive && !isGroupOpen
                      ? 'bg-purple-50/70 text-[#7C3AED] font-bold'
                      : 'text-dark-300 hover:bg-slate-50 hover:text-dark-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon
                      className={`h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                        groupActive ? 'text-[#7C3AED]' : 'text-dark-400'
                      }`}
                    />
                    <span className={groupActive ? 'text-[#7C3AED] font-semibold' : ''}>
                      {group.name}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-dark-400 transition-transform duration-200 ${
                      isGroupOpen ? 'rotate-180 text-[#7C3AED]' : ''
                    }`}
                  />
                </button>

                {/* Sub-items list with animated indent */}
                {isGroupOpen && (
                  <div className="ml-5 mt-1 space-y-1 pl-2.5 border-l-2 border-purple-100">
                    {group.children.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 rounded-lg px-2.5 py-2 min-h-[38px] text-xs font-medium transition-colors ${
                              isActive
                                ? 'text-[#7C3AED] font-bold bg-purple-50 shadow-2xs'
                                : 'text-dark-400 hover:text-dark-100 hover:bg-slate-50'
                            }`
                          }
                        >
                          <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{child.name}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Floating Rocket Illustration Section */}
          <div className="pt-8 pb-3 text-center relative overflow-hidden group">
            <div className="absolute top-6 left-6 text-purple-400 opacity-60 text-xs select-none">✦</div>
            <div className="absolute top-7 right-8 text-indigo-400 opacity-70 text-xs select-none">✨</div>

            <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
              <svg
                className="h-14 w-14 -rotate-12 transition-transform duration-300 group-hover:scale-110"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Exhaust flame & trail */}
                <path
                  d="M 12 36 C 8 42, 6 44, 4 46 C 10 44, 14 42, 16 38 Z"
                  fill="url(#exhaustGradient)"
                />
                <path
                  d="M 10 38 C 7 43, 6 45, 5 46 C 9 44, 12 42, 14 39 Z"
                  fill="#FDE047"
                />
                {/* Left fin */}
                <path
                  d="M 14 26 L 8 32 C 6 36, 10 38, 14 36 L 18 30 Z"
                  fill="#C084FC"
                />
                {/* Right fin */}
                <path
                  d="M 26 14 L 32 8 C 36 6, 38 10, 36 14 L 30 18 Z"
                  fill="#818CF8"
                />
                {/* Rocket Body */}
                <path
                  d="M 16 32 C 14 24, 20 12, 38 4 C 36 22, 24 28, 16 32 Z"
                  fill="url(#fuselageGradient)"
                  stroke="#7C3AED"
                  strokeWidth="1.5"
                />
                {/* Nose Cone Tip */}
                <path
                  d="M 32 10 C 35 7, 37 5, 38 4 C 37 5, 35 7, 32 10 Z"
                  fill="#EC4899"
                />
                {/* Porthole Window */}
                <circle
                  cx="26"
                  cy="16"
                  r="4.5"
                  fill="#FFFFFF"
                  stroke="#7C3AED"
                  strokeWidth="1.5"
                />
                <circle cx="26" cy="16" r="2.5" fill="#60A5FA" />
                <circle cx="25" cy="15" r="0.8" fill="#FFFFFF" />

                <defs>
                  <linearGradient id="fuselageGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#818CF8" />
                    <stop offset="60%" stopColor="#A78BFA" />
                    <stop offset="100%" stopColor="#EDE9FE" />
                  </linearGradient>
                  <linearGradient id="exhaustGradient" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F43F5E" />
                    <stop offset="60%" stopColor="#FB923C" />
                    <stop offset="100%" stopColor="#FBBF24" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <p className="mt-2 text-xs sm:text-sm font-extrabold text-dark-100 tracking-tight">
              DevOps Intelligence
            </p>
            <p className="text-[11px] font-medium text-dark-400">
              for Modern Teams
            </p>
          </div>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
