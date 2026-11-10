import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses = {
  primary:
    'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500/30 shadow-sm active:scale-[0.98]',
  secondary:
    'bg-white hover:bg-slate-50 text-dark-200 border border-[#E5E7EB] hover:border-slate-300 focus:ring-slate-200 shadow-sm active:scale-[0.98]',
  danger:
    'bg-danger-500 hover:bg-danger-600 text-white focus:ring-danger-500/30 shadow-sm active:scale-[0.98]',
  ghost:
    'bg-transparent hover:bg-primary-50 text-dark-300 hover:text-primary-700 focus:ring-primary-500/20 active:scale-[0.98]',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs min-h-[36px]',
  md: 'px-4 py-2.5 text-sm min-h-[44px]',
  lg: 'px-6 py-3 text-base min-h-[48px]',
};

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-xl',
        'transition-all duration-150 focus:outline-none focus:ring-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : leftIcon ? (
        <span className="mr-2">{leftIcon}</span>
      ) : null}
      {children}
      {rightIcon && !isLoading && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

export { Button };
export default Button;
