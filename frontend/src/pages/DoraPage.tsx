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
import { CountUp } from '@/components/ui/CountUp';

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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'High':
        return 'bg-primary-50 text-primary-700 border-primary-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100">
              DORA Metrics & Velocity
            </h1>
            {dora && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getRatingBadge(
                  dora.overall_performance
                )}`}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                {dora.overall_performance === 'Insufficient Data'
                  ? 'Awaiting Deployments'
                  : `${dora.overall_performance} Performer`}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-dark-400 mt-1">
            DevOps Research and Assessment industry standard benchmarks measuring software delivery efficiency
          </p>
        </div>

        <Button variant="secondary" onClick={fetchDora} leftIcon={<RefreshCw className="h-4 w-4" />}>
          Recalculate
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      {dora && (
        <>
          {dora.overall_performance === 'Insufficient Data' && (
            <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4 text-xs text-primary-800 flex items-center gap-2.5 shadow-2xs">
              <Info className="h-4 w-4 shrink-0 text-primary-600" />
              <span>
                <strong>Awaiting Pipeline Activity:</strong> No workflow runs or production deployments were detected in the past 30 days. Metrics display baseline states until CI/CD pipelines are triggered.
              </span>
            </div>
          )}

          {/* 4 DORA Core Metrics Cards (Responsive grid: 1 col on mobile, 2 on tablet, 4 on desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Deployment Frequency */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="p-2.5 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 shadow-2xs">
                    <Rocket className="h-5 w-5" />
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRatingBadge(
                      dora.deployment_frequency.rating
                    )}`}
                  >
                    {dora.deployment_frequency.rating}
                  </span>
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-dark-400 mt-4">Deployment Frequency</h3>
                <p className="text-2xl font-extrabold text-dark-100 mt-1">
                  <CountUp value={dora.deployment_frequency.value} />
                </p>
                <p className="text-xs text-dark-400 mt-2 font-medium">{dora.deployment_frequency.description}</p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#F1F5F9] text-[11px] text-dark-400 flex items-center justify-between">
                <span>Target:</span>
                <span className="text-emerald-700 font-semibold">On-Demand / Multiple per day</span>
              </div>
            </div>

            {/* Lead Time for Changes */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-2xs">
                    <Clock className="h-5 w-5" />
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRatingBadge(
                      dora.lead_time_for_changes.rating
                    )}`}
                  >
                    {dora.lead_time_for_changes.rating}
                  </span>
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-dark-400 mt-4">Lead Time for Changes</h3>
                <p className="text-2xl font-extrabold text-dark-100 mt-1">
                  <CountUp value={dora.lead_time_for_changes.value} />
                </p>
                <p className="text-xs text-dark-400 mt-2 font-medium">{dora.lead_time_for_changes.description}</p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#F1F5F9] text-[11px] text-dark-400 flex items-center justify-between">
                <span>Target:</span>
                <span className="text-emerald-700 font-semibold">&lt; 1 hour</span>
              </div>
            </div>

            {/* Change Failure Rate */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shadow-2xs">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRatingBadge(
                      dora.change_failure_rate.rating
                    )}`}
                  >
                    {dora.change_failure_rate.rating}
                  </span>
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-dark-400 mt-4">Change Failure Rate</h3>
                <p className="text-2xl font-extrabold text-dark-100 mt-1">
                  <CountUp value={dora.change_failure_rate.value} />
                </p>
                <p className="text-xs text-dark-400 mt-2 font-medium">{dora.change_failure_rate.description}</p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#F1F5F9] text-[11px] text-dark-400 flex items-center justify-between">
                <span>Target:</span>
                <span className="text-emerald-700 font-semibold">0 - 5%</span>
              </div>
            </div>

            {/* Mean Time to Restore */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs">
                    <RotateCcw className="h-5 w-5" />
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRatingBadge(
                      dora.mean_time_to_recovery.rating
                    )}`}
                  >
                    {dora.mean_time_to_recovery.rating}
                  </span>
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-dark-400 mt-4">Mean Time to Restore</h3>
                <p className="text-2xl font-extrabold text-dark-100 mt-1">
                  <CountUp value={dora.mean_time_to_recovery.value} />
                </p>
                <p className="text-xs text-dark-400 mt-2 font-medium">{dora.mean_time_to_recovery.description}</p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#F1F5F9] text-[11px] text-dark-400 flex items-center justify-between">
                <span>Target:</span>
                <span className="text-emerald-700 font-semibold">&lt; 1 hour</span>
              </div>
            </div>
          </div>

          {/* DORA Benchmark Guide Card */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-subtle">
            <h2 className="text-sm font-bold text-dark-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary-600" />
              DevOps Continuous Improvement Action Plan
            </h2>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-[#E5E7EB]">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  Automated Pipeline Triggers
                </div>
                <p className="text-xs text-dark-400 mt-2 font-medium">
                  Maintain continuous deployment with automatic test verification on feature branch merges.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-[#E5E7EB]">
                <div className="flex items-center gap-2 text-primary-700 font-bold text-xs">
                  <Gauge className="h-4 w-4" />
                  Build Time Optimization
                </div>
                <p className="text-xs text-dark-400 mt-2 font-medium">
                  Cache dependencies and split test suites into parallel matrix runners to decrease lead time.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-[#E5E7EB]">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-xs">
                  <Info className="h-4 w-4" />
                  Rollback Automation
                </div>
                <p className="text-xs text-dark-400 mt-2 font-medium">
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

export default DoraPage;
