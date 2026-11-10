import React, { useEffect, useState } from 'react';
import {
  Gauge,
  Rocket,
  Clock,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { analyticsService, DoraMetricsResponse } from '@/services/analytics';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export const DoraPage: React.FC = () => {
  const [dora, setDora] = useState<DoraMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDora = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await analyticsService.getDoraMetrics();
      setDora(data);
    } catch {
      setError('Failed to calculate DORA metrics. Please ensure repositories are imported.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDora();
  }, []);

  const getRatingBadge = (rating: string) => {
    switch (rating) {
      case 'Elite':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'High':
        return 'bg-primary-500/10 text-primary-400 border-primary-500/30';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Low':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-dark-800 text-dark-400 border-dark-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              DORA Metrics & Velocity
            </h1>
            {dora && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getRatingBadge(
                  dora.overall_performance
                )}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {dora.overall_performance === 'Insufficient Data'
                  ? 'Awaiting Deployments'
                  : `${dora.overall_performance} Performer`}
              </span>
            )}
          </div>
          <p className="text-xs text-dark-400 mt-1">
            DevOps Research and Assessment industry standard benchmarks measuring software delivery efficiency
          </p>
        </div>

        <Button variant="secondary" onClick={fetchDora} leftIcon={<RefreshCw className="h-4 w-4" />}>
          Recalculate
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-4 text-xs text-danger-300">
          {error}
        </div>
      )}

      {dora && (
        <>
          {dora.overall_performance === 'Insufficient Data' && (
            <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 p-4 text-xs text-primary-300 flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-primary-400" />
              <span>
                <strong>Awaiting Pipeline Activity:</strong> No workflow runs or production deployments were detected in the past 30 days. Metrics display baseline states until CI/CD pipelines are triggered.
              </span>
            </div>
          )}

          {/* 4 DORA Core Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Deployment Frequency */}
            <div className="glass-card p-5 border border-dark-700/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="p-2.5 rounded-lg bg-primary-500/10 text-primary-400">
                    <Rocket className="h-5 w-5" />
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${getRatingBadge(
                      dora.deployment_frequency.rating
                    )}`}
                  >
                    {dora.deployment_frequency.rating}
                  </span>
                </div>
                <h3 className="text-xs font-medium text-dark-400 mt-4">Deployment Frequency</h3>
                <p className="text-2xl font-bold text-white mt-1">{dora.deployment_frequency.value}</p>
                <p className="text-xs text-dark-400 mt-2">{dora.deployment_frequency.description}</p>
              </div>
              <div className="pt-4 mt-4 border-t border-dark-800 text-[11px] text-dark-400 flex items-center justify-between">
                <span>Target:</span>
                <span className="text-emerald-400 font-medium">On-Demand / Multiple per day</span>
              </div>
            </div>

            {/* Lead Time for Changes */}
            <div className="glass-card p-5 border border-dark-700/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Clock className="h-5 w-5" />
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${getRatingBadge(
                      dora.lead_time_for_changes.rating
                    )}`}
                  >
                    {dora.lead_time_for_changes.rating}
                  </span>
                </div>
                <h3 className="text-xs font-medium text-dark-400 mt-4">Lead Time for Changes</h3>
                <p className="text-2xl font-bold text-white mt-1">{dora.lead_time_for_changes.value}</p>
                <p className="text-xs text-dark-400 mt-2">{dora.lead_time_for_changes.description}</p>
              </div>
              <div className="pt-4 mt-4 border-t border-dark-800 text-[11px] text-dark-400 flex items-center justify-between">
                <span>Target:</span>
                <span className="text-emerald-400 font-medium">&lt; 1 hour</span>
              </div>
            </div>

            {/* Change Failure Rate */}
            <div className="glass-card p-5 border border-dark-700/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${getRatingBadge(
                      dora.change_failure_rate.rating
                    )}`}
                  >
                    {dora.change_failure_rate.rating}
                  </span>
                </div>
                <h3 className="text-xs font-medium text-dark-400 mt-4">Change Failure Rate</h3>
                <p className="text-2xl font-bold text-white mt-1">{dora.change_failure_rate.value}</p>
                <p className="text-xs text-dark-400 mt-2">{dora.change_failure_rate.description}</p>
              </div>
              <div className="pt-4 mt-4 border-t border-dark-800 text-[11px] text-dark-400 flex items-center justify-between">
                <span>Target:</span>
                <span className="text-emerald-400 font-medium">0 - 5%</span>
              </div>
            </div>

            {/* Mean Time to Restore */}
            <div className="glass-card p-5 border border-dark-700/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <RotateCcw className="h-5 w-5" />
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${getRatingBadge(
                      dora.mean_time_to_recovery.rating
                    )}`}
                  >
                    {dora.mean_time_to_recovery.rating}
                  </span>
                </div>
                <h3 className="text-xs font-medium text-dark-400 mt-4">Mean Time to Restore</h3>
                <p className="text-2xl font-bold text-white mt-1">{dora.mean_time_to_recovery.value}</p>
                <p className="text-xs text-dark-400 mt-2">{dora.mean_time_to_recovery.description}</p>
              </div>
              <div className="pt-4 mt-4 border-t border-dark-800 text-[11px] text-dark-400 flex items-center justify-between">
                <span>Target:</span>
                <span className="text-emerald-400 font-medium">&lt; 1 hour</span>
              </div>
            </div>
          </div>

          {/* DORA Benchmark Guide Card */}
          <div className="glass-card p-6 border border-dark-700/60">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary-400" />
              DevOps Continuous Improvement Action Plan
            </h2>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-dark-900/60 p-4 border border-dark-800">
                <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  Automated Pipeline Triggers
                </div>
                <p className="text-xs text-dark-400 mt-2">
                  Maintain continuous deployment with automatic test verification on feature branch merges.
                </p>
              </div>
              <div className="rounded-lg bg-dark-900/60 p-4 border border-dark-800">
                <div className="flex items-center gap-2 text-primary-400 font-medium text-xs">
                  <Gauge className="h-4 w-4" />
                  Build Time Optimization
                </div>
                <p className="text-xs text-dark-400 mt-2">
                  Cache dependencies and split test suites into parallel matrix runners to decrease lead time.
                </p>
              </div>
              <div className="rounded-lg bg-dark-900/60 p-4 border border-dark-800">
                <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
                  <Info className="h-4 w-4" />
                  Rollback Automation
                </div>
                <p className="text-xs text-dark-400 mt-2">
                  Enable automated canary deployments with immediate rollback on health probe error spikes.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
