import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { BuildTrend } from '@/types';

interface BuildTrendChartProps {
  data: BuildTrend | null;
  isLoading?: boolean;
}

export const BuildTrendChart: React.FC<BuildTrendChartProps> = ({ data, isLoading }) => {
  if (isLoading || !data || !Array.isArray(data.labels) || data.labels.length === 0) {
    return (
      <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl flex flex-col justify-center items-center h-80">
        <h3 className="text-base font-semibold text-white mb-1">CI/CD Build Trends</h3>
        <p className="text-xs text-dark-400">No build trend data available yet.</p>
      </div>
    );
  }

  const chartData = data.labels.map((dateStr, idx) => ({
    date: dateStr.length >= 10 ? dateStr.substring(5) : dateStr,
    success: (data.success && data.success[idx]) || 0,
    failure: (data.failure && data.failure[idx]) || 0,
  }));

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">CI/CD Build Trends</h3>
          <p className="text-xs text-dark-400">Success vs Failure outcomes (Last 30 days)</p>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorFailure" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
            </defs>
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
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
              formatter={(value) => (value === 'success' ? 'Successful Runs' : 'Failed Runs')}
            />
            <Area
              type="monotone"
              dataKey="success"
              stroke="#22c55e"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSuccess)"
            />
            <Area
              type="monotone"
              dataKey="failure"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorFailure)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
