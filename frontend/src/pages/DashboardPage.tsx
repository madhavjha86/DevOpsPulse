import React, { useEffect, useState } from 'react';
import { RefreshCw, Plus, GitFork } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { analyticsService } from '@/services/analytics';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { BuildTrendChart } from '@/components/dashboard/BuildTrendChart';
import { WorkflowPerformanceChart } from '@/components/dashboard/WorkflowPerformanceChart';
import { RepositoryActivityChart } from '@/components/dashboard/RepositoryActivityChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Button } from '@/components/ui/Button';
import type {
  DashboardStats,
  BuildTrend,
  ActivityItem,
  ChartDataPoint,
} from '@/types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [buildTrends, setBuildTrends] = useState<BuildTrend | null>(null);
  const [workflowPerf, setWorkflowPerf] = useState<ChartDataPoint[] | null>(null);
  const [repoActivity, setRepoActivity] = useState<ChartDataPoint[] | null>(null);
  const [activities, setActivities] = useState<ActivityItem[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, trendsRes, perfRes, activityRes, recentRes] = await Promise.all([
        analyticsService.getDashboardStats(),
        analyticsService.getBuildTrends(30),
        analyticsService.getWorkflowPerformance(14),
        analyticsService.getRepositoryActivity(14),
        analyticsService.getRecentActivity(),
      ]);

      setStats(statsRes.data);
      setBuildTrends(trendsRes.data);
      setWorkflowPerf(perfRes.data.chart_data);
      setRepoActivity(activityRes.data.chart_data);
      setActivities(recentRes.data.activities);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Developer Productivity & CI/CD Pulse
          </h1>
          <p className="text-xs text-dark-400">
            Real-time pipeline monitoring and repository analytics
          </p>
        </div>
        <div className="flex items-center gap-2.5">
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

      {/* 1. Summary Metrics Grid */}
      <StatsGrid stats={stats} isLoading={isLoading} />

      {/* 2. Middle Row: Build Trends & Recent Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BuildTrendChart data={buildTrends} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-1">
          <RecentActivity activities={activities} isLoading={isLoading} />
        </div>
      </div>

      {/* 3. Bottom Row: Workflow Execution Time & Commit Frequency */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WorkflowPerformanceChart data={workflowPerf} isLoading={isLoading} />
        <RepositoryActivityChart data={repoActivity} isLoading={isLoading} />
      </div>
    </div>
  );
};
