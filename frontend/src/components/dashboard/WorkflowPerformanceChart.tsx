import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ChartDataPoint } from '@/types';

interface WorkflowPerformanceChartProps {
  data: ChartDataPoint[] | null;
  isLoading?: boolean;
}

export const WorkflowPerformanceChart: React.FC<WorkflowPerformanceChartProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading || !data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl flex flex-col justify-center items-center h-72">
        <h3 className="text-base font-semibold text-white mb-1">Workflow Execution Time</h3>
        <p className="text-xs text-dark-400">No workflow performance history yet.</p>
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    date: d.label.length >= 10 ? d.label.substring(5) : d.label,
    duration: Math.round(d.value),
  }));

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">Workflow Execution Time</h3>
        <p className="text-xs text-dark-400">Average run duration in seconds (Last 14 days)</p>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f8fafc',
              }}
              formatter={(value) => [`${value}s`, 'Avg Duration']}
            />
            <Bar dataKey="duration" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
