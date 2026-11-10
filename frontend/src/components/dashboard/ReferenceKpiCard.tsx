import React from 'react';
import { LucideIcon } from 'lucide-react';
import { CountUp } from '@/components/ui/CountUp';

interface ReferenceKpiCardProps {
  title: string;
  value: number | string;
  unit?: string;
  trend: string;
  trendPositive?: boolean;
  icon: LucideIcon;
  variant: 'purple' | 'green' | 'amber' | 'rose';
  sparklineCurve: string;
  sparklineArea: string;
}

const variantStyles = {
  purple: {
    bg: 'bg-[#7C3AED] text-white',
    stroke: '#7C3AED',
    gradId: 'kpiPurpleGrad',
    gradStop: '#8B5CF6',
  },
  green: {
    bg: 'bg-[#10B981] text-white',
    stroke: '#10B981',
    gradId: 'kpiGreenGrad',
    gradStop: '#10B981',
  },
  amber: {
    bg: 'bg-[#F59E0B] text-white',
    stroke: '#F59E0B',
    gradId: 'kpiAmberGrad',
    gradStop: '#F59E0B',
  },
  rose: {
    bg: 'bg-[#F43F5E] text-white',
    stroke: '#F43F5E',
    gradId: 'kpiRoseGrad',
    gradStop: '#F43F5E',
  },
};

export const ReferenceKpiCard: React.FC<ReferenceKpiCardProps> = ({
  title,
  value,
  unit,
  trend,
  icon: Icon,
  variant,
  sparklineCurve,
  sparklineArea,
}) => {
  const styles = variantStyles[variant];

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 sm:p-5 shadow-subtle hover:shadow-card-hover hover:border-[#D1D5DB] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {/* Solid Squirclish Icon Container with Crisp White Icon */}
          <div
            className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl ${styles.bg} shadow-sm shadow-slate-200`}
          >
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white stroke-[2.2]" />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-dark-400 whitespace-nowrap">{title}</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-dark-100 tracking-tight">
                <CountUp value={value} />
              </span>
              {unit && <span className="text-xs sm:text-sm font-bold text-dark-100">{unit}</span>}
            </div>
            <p className="text-[10px] sm:text-[11px] font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              {trend}
            </p>
          </div>
        </div>

        {/* Mini Smooth Sparkline SVG Curve with Soft Area Gradient Fill */}
        <div className="w-16 sm:w-20 h-9 sm:h-10 shrink-0 hidden min-[520px]:block">
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 80 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id={styles.gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={styles.gradStop} stopOpacity="0.28" />
                <stop offset="100%" stopColor={styles.gradStop} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Area Fill */}
            <path d={sparklineArea} fill={`url(#${styles.gradId})`} />
            {/* Stroke Line */}
            <path
              d={sparklineCurve}
              stroke={styles.stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default ReferenceKpiCard;
