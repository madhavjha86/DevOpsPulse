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
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-subtle flex flex-col justify-center items-center h-72">
        <h3 className="text-base font-bold text-dark-100 mb-1">Workflow Execution Time</h3>
        <p className="text-xs font-medium text-dark-400">No workflow performance history yet.</p>
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    date: d.label.length >= 10 ? d.label.substring(5) : d.label,
    duration: Math.round(d.value),
  }));

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-subtle transition-all duration-200">
      <div className="mb-4">
        <h3 className="text-base font-bold text-dark-100">Workflow Execution Time</h3>
        <p className="text-xs font-medium text-dark-400">Average run duration in seconds (Last 14 days)</p>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis
              dataKey="date"
              stroke="#94A3B8"
              tick={{ fill: '#64748B', fontSize: 10 }}
              minTickGap={12}
              interval="preserveStartEnd"
            />
            <YAxis stroke="#94A3B8" tick={{ fill: '#64748B', fontSize: 11 }} />
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
              formatter={(value) => [`${value}s`, 'Avg Duration']}
            />
            <Bar
              dataKey="duration"
              fill="#7c3aed"
              radius={[6, 6, 0, 0]}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WorkflowPerformanceChart;
