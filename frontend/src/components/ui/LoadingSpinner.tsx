import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullScreen?: boolean;
  message?: string;
  text?: string;
}

const sizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  fullScreen = false,
  message,
  text,
}) => {
  const displayMsg = message || text;
  const spinner = (
    <div className={clsx('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2
        className={clsx('animate-spin text-primary-600', sizeClasses[size])}
      />
      {displayMsg && (
        <p className="text-sm font-medium text-dark-400 animate-pulse">{displayMsg}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/85 backdrop-blur-sm z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export { LoadingSpinner };
export default LoadingSpinner;
