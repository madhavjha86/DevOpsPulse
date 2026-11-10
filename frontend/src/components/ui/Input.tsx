import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  className,
  leftIcon,
  id,
  ...props
}) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-dark-300 tracking-wide"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-dark-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={clsx(
            'input-dark',
            leftIcon && 'pl-10',
            error && 'border-danger-400 focus:ring-danger-400/20 focus:border-danger-500',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-danger-500 font-medium">{error}</p>
      )}
    </div>
  );
};

export { Input };
export default Input;
