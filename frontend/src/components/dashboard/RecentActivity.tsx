import React from 'react';
import {
  GitCommit,
  GitBranch,
  GitPullRequest,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { ActivityItem } from '@/types';

interface RecentActivityProps {
  activities: ActivityItem[] | null;
  isLoading?: boolean;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ activities, isLoading }) => {
  if (isLoading || !activities) {
    return (
      <div className="h-80 w-full rounded-2xl bg-white border border-[#E5E7EB] shadow-subtle animate-pulse p-6" />
    );
  }

  const formatTimestamp = (timestampStr: string): string => {
    try {
      const d = new Date(timestampStr);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return timestampStr;
    }
  };

  const getActivityIcon = (activity: ActivityItem) => {
    if (activity.type === 'workflow') {
      const desc = activity.description.toLowerCase();
      if (desc.includes('success')) {
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      }
      if (desc.includes('fail')) {
        return <XCircle className="h-4 w-4 text-rose-500" />;
      }
      return <GitBranch className="h-4 w-4 text-primary-600" />;
    }
    if (activity.type === 'pr') {
      return <GitPullRequest className="h-4 w-4 text-amber-600" />;
    }
    if (activity.type === 'issue') {
      return <AlertCircle className="h-4 w-4 text-rose-500" />;
    }
    return <GitCommit className="h-4 w-4 text-primary-600" />;
  };

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-subtle flex flex-col h-full transition-all duration-200">
      <div className="mb-4">
        <h3 className="text-base font-bold text-dark-100">Recent Activity</h3>
        <p className="text-xs font-medium text-dark-400">Live stream across tracked repositories</p>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-xs text-dark-400 font-medium">
          No recent activity recorded. Connect a repository to start tracking live GitHub events!
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto max-h-72 pr-1">
          {activities.map((act, index) => {
            const ItemWrapper = act.url ? 'a' : 'div';
            const linkProps = act.url
              ? {
                  href: act.url,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                }
              : {};

            return (
              <ItemWrapper
                key={index}
                {...linkProps}
                className="group flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-slate-50/60 p-3 hover:bg-slate-100/70 hover:border-slate-300 transition-all duration-150 cursor-pointer"
              >
                <div className="mt-0.5 rounded-lg bg-white p-1.5 shrink-0 border border-[#E5E7EB] shadow-2xs group-hover:border-primary-300 transition-colors">
                  {getActivityIcon(act)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-dark-100 truncate group-hover:text-primary-600 transition-colors flex items-center gap-1.5">
                      <span>{act.title}</span>
                      {act.url && (
                        <ExternalLink className="h-3 w-3 text-dark-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                    </p>
                    <span className="flex items-center gap-1 text-[10px] text-dark-400 shrink-0 font-medium">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(act.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-dark-400 truncate">{act.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {act.repository_name && (
                      <span className="inline-block rounded-md bg-white border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-semibold text-primary-700 shadow-2xs">
                        {act.repository_name}
                      </span>
                    )}
                    {act.author && (
                      <span className="inline-block rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-dark-300">
                        @{act.author}
                      </span>
                    )}
                  </div>
                </div>
              </ItemWrapper>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
