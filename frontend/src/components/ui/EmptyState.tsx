import React from 'react';
import { clsx } from 'clsx';
import { LucideIcon, Inbox } from 'lucide-react';
import Button from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center py-16 px-6 text-center bg-white border border-[#E5E7EB] rounded-2xl shadow-subtle',
        className
      )}
    >
      <div className="p-4 rounded-2xl bg-primary-50 border border-primary-100 mb-4 shadow-sm">
        <Icon className="w-8 h-8 text-primary-600" />
      </div>
      <h3 className="text-base font-bold text-dark-100 mb-1">{title}</h3>
      <p className="text-sm text-dark-400 max-w-sm mb-6">{description}</p>
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

export { EmptyState };
export default EmptyState;
