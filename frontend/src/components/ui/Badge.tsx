import React from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantClasses = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  danger: 'bg-rose-50 text-rose-600 border-rose-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-primary-50 text-primary-700 border-primary-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

const dotColors = {
  success: 'bg-emerald-500',
  danger: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-primary-500',
  neutral: 'bg-slate-400',
};

const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className,
  dot = false,
}) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        variantClasses[variant],
        className
      )}
    >
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full mr-1.5', dotColors[variant])}
        />
      )}
      {children}
    </span>
  );
};

export { Badge };
export default Badge;
