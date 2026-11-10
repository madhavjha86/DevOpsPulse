import React from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantClasses = {
  success: 'bg-success-500/15 text-success-400 border-success-500/20',
  danger: 'bg-danger-500/15 text-danger-400 border-danger-500/20',
  warning: 'bg-warning-500/15 text-warning-400 border-warning-500/20',
  info: 'bg-primary-500/15 text-primary-400 border-primary-500/20',
  neutral: 'bg-dark-600/50 text-dark-300 border-dark-500/20',
};

const dotColors = {
  success: 'bg-success-400',
  danger: 'bg-danger-400',
  warning: 'bg-warning-400',
  info: 'bg-primary-400',
  neutral: 'bg-dark-400',
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
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
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
