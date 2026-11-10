import React from 'react';
import { clsx } from 'clsx';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

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
}

const colorMap = {
  primary: 'text-primary-400 bg-primary-500/10',
  success: 'text-success-400 bg-success-500/10',
  danger: 'text-danger-400 bg-danger-500/10',
  warning: 'text-warning-400 bg-warning-500/10',
};

const Card: React.FC<CardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  color = 'primary',
  className,
}) => {
  return (
    <div
      className={clsx(
        'glass-card-hover p-6 group',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-dark-400 truncate">{title}</p>
          <p className="mt-2 text-3xl font-bold text-dark-50 tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {trend && (
            <div className="flex items-center mt-2 space-x-1">
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4 text-success-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-danger-400" />
              )}
              <span
                className={clsx(
                  'text-sm font-medium',
                  trend.isPositive ? 'text-success-400' : 'text-danger-400'
                )}
              >
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={clsx(
              'p-3 rounded-xl transition-transform duration-300 group-hover:scale-110',
              colorMap[color]
            )}
          >
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
};

export { Card };
export default Card;
