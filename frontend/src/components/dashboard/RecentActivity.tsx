import React from 'react';
import { GitCommit, GitBranch, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { ActivityItem } from '@/types';

interface RecentActivityProps {
  activities: ActivityItem[] | null;
  isLoading?: boolean;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ activities, isLoading }) => {
  if (isLoading || !activities) {
    return (
      <div className="h-80 w-full rounded-2xl bg-dark-900/60 border border-dark-800 animate-pulse p-6" />
    );
  }

  const formatTimestamp = (timestampStr: string): string => {
    try {
      const d = new Date(timestampStr);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return timestampStr;
    }
  };

  const getActivityIcon = (activity: ActivityItem) => {
    if (activity.type === 'workflow') {
      if (activity.description.toLowerCase().includes('success')) {
        return <CheckCircle2 className="h-4 w-4 text-success-400" />;
      }
      if (activity.description.toLowerCase().includes('fail')) {
        return <XCircle className="h-4 w-4 text-danger-400" />;
      }
      return <GitBranch className="h-4 w-4 text-primary-400" />;
    }
    return <GitCommit className="h-4 w-4 text-primary-400" />;
  };

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">Recent Activity</h3>
        <p className="text-xs text-dark-400">Live stream across tracked repositories</p>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-xs text-dark-400">
          No recent activity recorded. Import a repository to start tracking!
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-72 pr-1">
          {activities.map((act, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg border border-dark-800/80 bg-dark-800/40 p-3 hover:bg-dark-800 transition-colors"
            >
              <div className="mt-0.5 rounded-md bg-dark-900 p-1.5 shrink-0 border border-dark-700/50">
                {getActivityIcon(act)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-dark-200 truncate">{act.title}</p>
                  <span className="flex items-center gap-1 text-[10px] text-dark-400 shrink-0">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(act.timestamp)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-dark-400 truncate">{act.description}</p>
                {act.repository_name && (
                  <span className="mt-1.5 inline-block rounded bg-dark-700/60 px-1.5 py-0.5 text-[10px] font-medium text-dark-300">
                    {act.repository_name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
