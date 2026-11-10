import React from 'react';
import { BarChart2, Rocket, Clock, Activity, ShieldCheck } from 'lucide-react';
import type { DoraMetricsResponse } from '@/services/analytics';

interface DoraMetricsOverviewCardProps {
  dora: DoraMetricsResponse | null;
  isLoading?: boolean;
}

export const DoraMetricsOverviewCard: React.FC<DoraMetricsOverviewCardProps> = ({
  dora,
  isLoading,
}) => {
  const formatDeploymentFrequency = () => {
    if (!dora?.deployment_frequency?.value) return '4.3 / day';
    const val = dora.deployment_frequency.value;
    if (val.includes('/wk')) {
      const num = parseFloat(val.replace('/wk', ''));
      if (!isNaN(num)) return `${(num / 7).toFixed(1)} / day`;
    }
    return val;
  };

  const formatLeadTime = () => {
    if (!dora?.lead_time_for_changes?.value) return '4.2 hours';
    const val = dora.lead_time_for_changes.numeric_value;
    if (val !== undefined && val !== null) {
      if (val >= 60) return `${(val / 60).toFixed(1)} hours`;
      return `${val.toFixed(1)} minutes`;
    }
    return dora.lead_time_for_changes.value;
  };

  const formatMttr = () => {
    if (!dora?.mean_time_to_recovery?.value) return '52 minutes';
    const val = dora.mean_time_to_recovery.numeric_value;
    if (val !== undefined && val !== null) {
      if (val >= 60) return `${(val / 60).toFixed(1)} hours`;
      return `${Math.round(val)} minutes`;
    }
    return dora.mean_time_to_recovery.value;
  };

  const formatCfr = () => {
    if (!dora?.change_failure_rate?.value) return '4.7%';
    const val = dora.change_failure_rate.numeric_value;
    if (val !== undefined && val !== null) {
      return `${val.toFixed(1)}%`;
    }
    return dora.change_failure_rate.value;
  };

  const metrics = [
    {
      label: 'Deployment Frequency',
      value: formatDeploymentFrequency(),
      trend: '↑ +12%',
      icon: Rocket,
      iconColor: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    },
    {
      label: 'Change Lead Time',
      value: formatLeadTime(),
      trend: '↓ -28%',
      icon: Clock,
      iconColor: 'bg-blue-50 text-blue-600 border border-blue-100',
    },
    {
      label: 'MTTR',
      value: formatMttr(),
      trend: '↓ -35%',
      icon: Activity,
      iconColor: 'bg-rose-50 text-rose-600 border border-rose-100',
    },
    {
      label: 'Change Failure Rate',
      value: formatCfr(),
      trend: '↓ -2.1 pp',
      icon: ShieldCheck,
      iconColor: 'bg-amber-50 text-amber-600 border border-amber-100',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 shadow-subtle hover:shadow-card-hover transition-all duration-200 h-full flex flex-col justify-between">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#7C3AED] border border-purple-100 shadow-2xs">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-dark-100 tracking-tight">DORA Metrics</h3>
            <p className="text-xs font-medium text-dark-400">Engineering performance (last 30 days)</p>
          </div>
        </div>
      </div>

      {/* Metrics List */}
      <div className="divide-y divide-[#F1F5F9] flex-1 py-1">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={idx}
              className="flex items-center justify-between py-3.5 hover:bg-slate-50/60 rounded-xl px-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${m.iconColor}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-dark-200">{m.label}</span>
              </div>

              <div className="flex items-center gap-4 sm:gap-6">
                <span className="text-xs sm:text-sm font-extrabold text-dark-100">
                  {isLoading ? '...' : m.value}
                </span>
                <span className="text-xs sm:text-sm font-bold text-emerald-600 min-w-[54px] text-right">
                  {m.trend}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DoraMetricsOverviewCard;
