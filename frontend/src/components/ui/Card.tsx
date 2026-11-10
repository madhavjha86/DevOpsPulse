import React from 'react';
import { clsx } from 'clsx';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { CountUp } from '@/components/ui/CountUp';

interface CardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'primary' | 'success' | 'danger' | 'warning';
  className?: string;
  animateValue?: boolean;
}

const colorMap = {
  primary: 'text-primary-600 bg-primary-50 border border-primary-100',
  success: 'text-success-600 bg-success-50 border border-success-100',
  danger: 'text-danger-500 bg-danger-50 border border-danger-100',
  warning: 'text-warning-600 bg-warning-50 border border-warning-100',
};

const Card: React.FC<CardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  color = 'primary',
  className,
  animateValue = true,
}) => {
  return (
    <div
      className={clsx(
        'group bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover hover:border-[#D1D5DB] hover:-translate-y-0.5 transition-all duration-200',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-400 truncate">
            {title}
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-dark-100 tracking-tight">
            {animateValue ? (
              <CountUp value={value} />
            ) : typeof value === 'number' ? (
              value.toLocaleString()
            ) : (
              value
            )}
          </p>
          {trend && (
            <div className="flex items-center mt-2.5 space-x-1.5">
              {trend.isPositive ? (
                <TrendingUp className="w-3.5 h-3.5 text-success-600" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-danger-500" />
              )}
              <span
                className={clsx(
                  'text-xs font-semibold',
                  trend.isPositive ? 'text-success-600' : 'text-danger-500'
                )}
              >
                {trend.value}%
              </span>
              <span className="text-[11px] text-dark-400">vs last period</span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={clsx(
              'p-2.5 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-sm',
              colorMap[color]
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};

export { Card };
export default Card;
