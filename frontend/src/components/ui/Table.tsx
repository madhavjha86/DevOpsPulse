import React from 'react';
import { clsx } from 'clsx';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (item: T) => string | number;
  className?: string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

function Table<T>({
  columns,
  data,
  keyExtractor = (item: any) => item?.id ?? item?.sha ?? item?.number ?? item?.key,
  className,
  onRowClick,
  emptyMessage = 'No data available',
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-12 text-center shadow-subtle">
        <p className="text-sm font-medium text-dark-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={clsx('bg-white border border-[#E5E7EB] rounded-2xl shadow-subtle overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-slate-50/70">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-3.5 sm:px-6 py-3 sm:py-3.5 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={clsx(
                  'hover:bg-slate-50/70 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      'px-3.5 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-dark-200 whitespace-nowrap',
                      col.className
                    )}
                  >
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { Table };
export default Table;
