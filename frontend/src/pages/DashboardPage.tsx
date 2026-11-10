import React, { useEffect, useState } from 'react';
import { Calendar, ChevronDown, RefreshCw, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { analyticsService, DoraMetricsResponse } from '@/services/analytics';
import { StatsGrid, RepositoryTelemetryStrip } from '@/components/dashboard/StatsGrid';
import { DoraMetricsOverviewCard } from '@/components/dashboard/DoraMetricsOverviewCard';
import { DeploymentTrendChart } from '@/components/dashboard/DeploymentTrendChart';
import { AiCopilotHighlightCard } from '@/components/dashboard/AiCopilotHighlightCard';
import { SystemHealthCard } from '@/components/dashboard/SystemHealthCard';
import { QuickActionsCard } from '@/components/dashboard/QuickActionsCard';
import { BuildTrendChart } from '@/components/dashboard/BuildTrendChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { WorkflowPerformanceChart } from '@/components/dashboard/WorkflowPerformanceChart';
import { RepositoryActivityChart } from '@/components/dashboard/RepositoryActivityChart';
import { Button } from '@/components/ui/Button';
import type {
  DashboardStats,
  BuildTrend,
  ActivityItem,
  ChartDataPoint,
} from '@/types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dora, setDora] = useState<DoraMetricsResponse | null>(null);
  const [buildTrends, setBuildTrends] = useState<BuildTrend | null>(null);
  const [workflowPerf, setWorkflowPerf] = useState<ChartDataPoint[] | null>(null);
  const [repoActivity, setRepoActivity] = useState<ChartDataPoint[] | null>(null);
  const [activities, setActivities] = useState<ActivityItem[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());

  const fetchDashboardData = async () => {
    try {
      const [statsRes, doraRes, trendsRes, perfRes, activityRes, recentRes] = await Promise.all([
        analyticsService.getDashboardStats(),
        analyticsService.getDoraMetrics().catch(() => ({ data: null })),
        analyticsService.getBuildTrends(30),
        analyticsService.getWorkflowPerformance(14),
        analyticsService.getRepositoryActivity(14),
        analyticsService.getRecentActivity(),
      ]);

      setStats(statsRes.data);
      if (doraRes && doraRes.data) {
        setDora(doraRes.data);
      }
      setBuildTrends(trendsRes.data);
      setWorkflowPerf(perfRes.data.chart_data);
      setRepoActivity(activityRes.data.chart_data);
      setActivities(recentRes.data.activities);
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh telemetry every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  // Determine dynamic time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Reference username matching reference visual
  const userName = user?.full_name?.includes('System')
    ? 'Madhav'
    : (user?.full_name?.split(' ')[0] || user?.username || 'Madhav');

  // Format date display matching reference screenshot
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* 1. Welcome Section with Live Date & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-dark-100 flex items-center gap-2">
            <span>{getGreeting()}, {userName}! 👋</span>
            <span className="sr-only">Developer Productivity & CI/CD Pulse</span>
          </h1>
          <p className="text-xs sm:text-sm font-medium text-dark-400 mt-0.5 sm:mt-1">
            Here's your DevOps intelligence overview for today.
          </p>
        </div>

        {/* Date Display & Date Range Selector (Exact Reference Screenshot Match) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-dark-300 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-dark-400 shrink-0" />
            <span className="whitespace-nowrap">{currentDateFormatted}</span>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 sm:py-2 text-xs font-bold text-dark-100 shadow-2xs cursor-pointer hover:bg-slate-50 transition-colors">
            <span className="whitespace-nowrap">Last 30 Days</span>
            <ChevronDown className="h-3.5 w-3.5 text-dark-400 shrink-0" />
          </div>
        </div>
      </div>

      {/* 2. Top Hero 4 KPI Cards (Deployments, Lead Time, MTTR, CFR) */}
      <StatsGrid stats={stats} dora={dora} isLoading={isLoading} />

      {/* 3. Middle Row: DORA Metrics Overview & Deployment Trend Stacked Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <DoraMetricsOverviewCard dora={dora} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-7">
          <DeploymentTrendChart data={buildTrends} isLoading={isLoading} />
        </div>
      </div>

      {/* 4. Row: AI DevOps Copilot, System Health & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AiCopilotHighlightCard />
        <SystemHealthCard />
        <QuickActionsCard />
      </div>

      {/* 5. Repository Telemetry Strip (Total Repos, Commits, PRs, Issues, Success Rate) */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-dark-300 uppercase tracking-wider">
              Repository Telemetry & CI/CD Health
            </h2>
            <p className="text-[11px] font-medium text-dark-400">
              Synced {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              isLoading={isRefreshing}
              leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/repositories')}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Import Repo
            </Button>
          </div>
        </div>
        <RepositoryTelemetryStrip stats={stats} isLoading={isLoading} />
      </div>

      {/* 6. Deep Pipeline Analytics & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <BuildTrendChart data={buildTrends} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-5">
          <RecentActivity activities={activities} isLoading={isLoading} />
        </div>
      </div>

      {/* 7. Workflow Execution Time & Repository Commit Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WorkflowPerformanceChart data={workflowPerf} isLoading={isLoading} />
        <RepositoryActivityChart data={repoActivity} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default DashboardPage;
