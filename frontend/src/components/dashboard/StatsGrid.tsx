import React from 'react';
import {
  GitFork,
  GitCommit,
  GitPullRequest,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Percent,
  Rocket,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { DashboardStats } from '@/types';

interface StatsGridProps {
  stats: DashboardStats | null;
  isLoading?: boolean;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats, isLoading }) => {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-dark-900/60 border border-dark-800 animate-pulse p-4"
          />
        ))}
      </div>
    );
  }

  const statItems = [
    {
      title: 'Total Repositories',
      value: stats.total_repositories,
      icon: GitFork,
      color: 'primary' as const,
    },
    {
      title: 'Total Commits',
      value: stats.total_commits,
      icon: GitCommit,
      color: 'primary' as const,
    },
    {
      title: 'Pull Requests',
      value: stats.total_pull_requests,
      icon: GitPullRequest,
      color: 'warning' as const,
    },
    {
      title: 'Open Issues',
      value: stats.open_issues,
      icon: AlertCircle,
      color: 'danger' as const,
    },
    {
      title: 'Successful Builds',
      value: stats.successful_builds,
      icon: CheckCircle2,
      color: 'success' as const,
    },
    {
      title: 'Failed Builds',
      value: stats.failed_builds,
      icon: XCircle,
      color: 'danger' as const,
    },
    {
      title: 'Success Rate',
      value:
        stats.successful_builds + stats.failed_builds > 0
          ? `${stats.build_success_rate}%`
          : 'N/A',
      icon: Percent,
      color:
        stats.successful_builds + stats.failed_builds === 0
          ? ('primary' as const)
          : stats.build_success_rate >= 80
            ? ('success' as const)
            : ('warning' as const),
    },
    {
      title: 'Total Deployments',
      value: stats.total_deployments,
      icon: Rocket,
      color: 'primary' as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <Card
          key={item.title}
          title={item.title}
          value={item.value}
          icon={item.icon}
          color={item.color}
        />
      ))}
    </div>
  );
};
