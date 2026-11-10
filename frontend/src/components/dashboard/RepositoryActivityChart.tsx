import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ChartDataPoint } from '@/types';

interface RepositoryActivityChartProps {
  data: ChartDataPoint[] | null;
  isLoading?: boolean;
}

export const RepositoryActivityChart: React.FC<RepositoryActivityChartProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading || !data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl flex flex-col justify-center items-center h-72">
        <h3 className="text-base font-semibold text-white mb-1">Repository Commit Activity</h3>
        <p className="text-xs text-dark-400">No commit activity recorded yet.</p>
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    date: d.label.length >= 10 ? d.label.substring(5) : d.label,
    commits: Math.round(d.value),
  }));

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">Repository Commit Activity</h3>
        <p className="text-xs text-dark-400">Total commits pushed per day (Last 14 days)</p>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f8fafc',
              }}
              formatter={(value) => [value, 'Commits']}
            />
            <Line
              type="monotone"
              dataKey="commits"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
