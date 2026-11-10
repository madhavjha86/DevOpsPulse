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
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      <div className="p-4 rounded-2xl bg-dark-800/50 mb-4">
        <Icon className="w-10 h-10 text-dark-500" />
      </div>
      <h3 className="text-lg font-semibold text-dark-200 mb-1">{title}</h3>
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
