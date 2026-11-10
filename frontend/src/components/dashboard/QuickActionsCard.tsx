import React from 'react';
import { Zap, Play, AlertTriangle, Sparkles, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const QuickActionsCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 shadow-subtle hover:shadow-card-hover transition-all duration-200 h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#F1F5F9]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#7C3AED] border border-purple-100 shadow-2xs">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-dark-100 tracking-tight">Quick Actions</h3>
        </div>
      </div>

      {/* 2x2 Action Buttons Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 my-auto pt-2">
        {/* Action 1: Run Pipeline */}
        <button
          onClick={() => navigate('/workflows')}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#F5F3FF] p-3 sm:p-4 min-h-[64px] text-center transition-all hover:bg-purple-100/70 active:scale-[0.98] group"
        >
          <Play className="h-4 w-4 text-[#7C3AED] group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-[#7C3AED]">Run Pipeline</span>
        </button>

        {/* Action 2: View Incidents */}
        <button
          onClick={() => navigate('/uptime')}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#FFF1F2] p-3 sm:p-4 min-h-[64px] text-center transition-all hover:bg-rose-100/70 active:scale-[0.98] group"
        >
          <AlertTriangle className="h-4 w-4 text-[#E11D48] group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-[#E11D48]">View Incidents</span>
        </button>

        {/* Action 3: AI Analyze PR */}
        <button
          onClick={() => navigate('/ai/code-intelligence')}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#EFF6FF] p-3 sm:p-4 min-h-[64px] text-center transition-all hover:bg-blue-100/70 active:scale-[0.98] group"
        >
          <Sparkles className="h-4 w-4 text-[#2563EB] group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-[#2563EB]">AI Analyze PR</span>
        </button>

        {/* Action 4: Generate Report */}
        <button
          onClick={() => navigate('/dora')}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#F0FDF4] p-3 sm:p-4 min-h-[64px] text-center transition-all hover:bg-emerald-100/70 active:scale-[0.98] group"
        >
          <BarChart2 className="h-4 w-4 text-[#16A34A] group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-[#16A34A]">Generate Report</span>
        </button>
      </div>
    </div>
  );
};

export default QuickActionsCard;
