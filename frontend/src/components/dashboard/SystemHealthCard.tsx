import React, { useEffect, useState } from 'react';
import { Server, Activity } from 'lucide-react';
import api from '@/services/api';

interface ServiceStatus {
  name: string;
  status: 'Healthy' | 'Degraded' | 'Offline';
}

export const SystemHealthCard: React.FC = () => {
  const [services] = useState<ServiceStatus[]>([
    { name: 'API Service', status: 'Healthy' },
    { name: 'Worker', status: 'Healthy' },
    { name: 'PostgreSQL', status: 'Healthy' },
    { name: 'Redis', status: 'Healthy' },
  ]);

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 shadow-subtle hover:shadow-card-hover transition-all duration-200 h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#F1F5F9]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#7C3AED] border border-purple-100 shadow-2xs">
          <Server className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-dark-100 tracking-tight">System Health</h3>
          <p className="text-xs font-medium text-dark-400">
            Infrastructure & service status
          </p>
        </div>
      </div>

      {/* Services List */}
      <div className="divide-y divide-[#F1F5F9] my-1 flex-1 flex flex-col justify-around">
        {services.map((s, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between py-2.5 px-1 hover:bg-slate-50/60 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs sm:text-sm font-semibold text-dark-200">{s.name}</span>
            </div>
            <div>
              <span className="rounded-full bg-[#DCFCE7] px-3 py-0.5 text-xs font-bold text-[#16A34A]">
                {s.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SystemHealthCard;
