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
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-subtle flex flex-col justify-center items-center h-80">
        <h3 className="text-base font-bold text-dark-100 mb-1">CI/CD Build Trends</h3>
        <p className="text-xs font-medium text-dark-400">No build trend data available yet.</p>
      </div>
    );
  }

  const chartData = data.labels.map((dateStr, idx) => ({
    date: dateStr.length >= 10 ? dateStr.substring(5) : dateStr,
    success: (data.success && data.success[idx]) || 0,
    failure: (data.failure && data.failure[idx]) || 0,
  }));

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-subtle transition-all duration-200">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-dark-100">CI/CD Build Trends</h3>
          <p className="text-xs font-medium text-dark-400">Success vs Failure outcomes (Last 30 days)</p>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorFailure" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis
              dataKey="date"
              stroke="#94A3B8"
              tick={{ fill: '#64748B', fontSize: 10 }}
              minTickGap={12}
              interval="preserveStartEnd"
            />
            <YAxis stroke="#94A3B8" tick={{ fill: '#64748B', fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E5E7EB',
                borderRadius: '12px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
                fontSize: '12px',
                color: '#111827',
                fontWeight: 500,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: '#64748B' }}
            />
            <Area
              type="monotone"
              dataKey="success"
              name="Successful Builds"
              stroke="#16a34a"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSuccess)"
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="failure"
              name="Failed Builds"
              stroke="#f43f5e"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorFailure)"
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BuildTrendChart;
