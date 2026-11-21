import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  Coins,
  Copy,
  Cpu,
  Download,
  Edit2,
  ExternalLink,
  Layers,
  PieChart as PieIcon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import {
  aiGovernanceService,
  AIGovernanceSummary,
  AIEmployeeUsage,
} from '../services/aiGovernance';

const TOOL_COLORS: Record<string, string> = {
  'Claude Code': '#D97706',
  'Cursor IDE': '#2563EB',
  'DevOpsPulse Copilot': '#8B5CF6',
  'OpenAI Codex': '#10B981',
  'GitHub Copilot': '#0EA5E9',
  'CLI Assistant': '#64748B',
};

const DEFAULT_COLOR = '#6366F1';

export const AIGovernancePage: React.FC = () => {
  const [summaryData, setSummaryData] = useState<AIGovernanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<number>(30);
  const [searchQuery, setSearchQuery] = useState('');

  // Quota Modal
  const [selectedEmployee, setSelectedEmployee] = useState<AIEmployeeUsage | null>(null);
  const [costLimitInput, setCostLimitInput] = useState<number>(50);
  const [tokenLimitInput, setTokenLimitInput] = useState<number>(5000000);
  const [actionInput, setActionInput] = useState<'NOTIFY' | 'BLOCK'>('NOTIFY');
  const [savingQuota, setSavingQuota] = useState(false);

  // Ingestion Guide Modal
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'cursor' | 'claude' | 'codex' | 'rest'>('cursor');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await aiGovernanceService.getSummary(timeframe);
      if (!data || typeof data !== 'object' || !data.summary) {
        throw new Error('Received unexpected response format from server');
      }
      setSummaryData(data);
    } catch (err: unknown) {
      console.error('Failed to load AI governance metrics', err);
      const message =
        err instanceof Error ? err.message : 'Failed to load AI governance metrics';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleOpenQuotaModal = (emp: AIEmployeeUsage) => {
    setSelectedEmployee(emp);
    setCostLimitInput(emp.monthly_cost_limit);
    setTokenLimitInput(emp.monthly_token_limit);
    setActionInput(emp.enforcement_action);
  };

  const handleSaveQuota = async () => {
    if (!selectedEmployee) return;
    setSavingQuota(true);
    try {
      await aiGovernanceService.updateUserQuota(selectedEmployee.user_id, {
        monthly_cost_limit_usd: Number(costLimitInput),
        monthly_token_limit: Number(tokenLimitInput),
        enforcement_action: actionInput,
      });
      setSelectedEmployee(null);
      await fetchSummary();
    } catch (err) {
      console.error('Failed to update quota', err);
    } finally {
      setSavingQuota(false);
    }
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
    return tokens.toLocaleString();
  };

  const employeesList = summaryData?.employees ?? [];
  const filteredEmployees = employeesList.filter((emp) => {
    const q = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      emp.role.toLowerCase().includes(q)
    );
  });

  if (loading && (!summaryData || !summaryData.summary)) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" message="Loading Enterprise AI Governance metrics..." />
      </div>
    );
  }

  if (!summaryData || !summaryData.summary) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center space-y-4 shadow-2xs max-w-lg mx-auto my-12">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold text-dark-100">Unable to load AI Governance metrics</h3>
        <p className="text-xs text-dark-300">
          {error || 'Could not fetch token telemetry from the server. Please check your connection or login session.'}
        </p>
        <Button size="sm" onClick={fetchSummary} className="mx-auto">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-dark-100 flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary-600" />
              Enterprise AI Governance & Token FinOps
            </h1>
            <Badge variant="info">Enterprise</Badge>
          </div>
          <p className="text-xs text-dark-300 mt-1">
            Audit, attribute, and govern token consumption and costs across Claude Code, Cursor, Codex, and Copilot.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Selector */}
          <div className="inline-flex rounded-lg border border-[#E5E7EB] bg-white p-0.5 text-xs shadow-2xs">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setTimeframe(days)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  timeframe === days
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'text-dark-300 hover:text-dark-100'
                }`}
              >
                {days === 7 ? '7 Days' : days === 30 ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowIngestModal(true)}
            className="text-xs flex items-center gap-1.5"
          >
            <Terminal className="h-3.5 w-3.5 text-primary-600" />
            Connect Dev Tools
          </Button>

          <a
            href={aiGovernanceService.getExportUrl(timeframe)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5E7EB] bg-white hover:bg-slate-50 text-dark-200 transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSummary}
            className="p-2 text-dark-400 hover:text-dark-200"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Spend */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-3.5 border-l-4 border-l-primary-500 shadow-2xs">
          <div className="p-2.5 bg-primary-50 rounded-xl text-primary-600">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-dark-300 block">Total AI Spend ({timeframe}d)</span>
            <div className="text-xl font-bold text-dark-100 mt-0.5">
              ${(summaryData?.summary?.total_cost_usd ?? 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-dark-400">Calculated per model token rates</span>
          </div>
        </div>

        {/* Total Tokens */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-3.5 border-l-4 border-l-blue-500 shadow-2xs">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-dark-300 block">Total Tokens Ingested</span>
            <div className="text-xl font-bold text-dark-100 mt-0.5">
              {formatTokens(summaryData?.summary?.total_tokens ?? 0)}
            </div>
            <span className="text-[10px] text-dark-400">
              Prompt: {formatTokens(summaryData?.summary?.prompt_tokens ?? 0)} · Comp: {formatTokens(summaryData?.summary?.completion_tokens ?? 0)}
            </span>
          </div>
        </div>

        {/* Active Developers */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-3.5 border-l-4 border-l-emerald-500 shadow-2xs">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-dark-300 block">Active AI Users</span>
            <div className="text-xl font-bold text-dark-100 mt-0.5">
              {summaryData?.summary?.active_developers ?? 0} Developers
            </div>
            <span className="text-[10px] text-emerald-600 font-medium">100% of workspace tracked</span>
          </div>
        </div>

        {/* Average Cost per Dev */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-3.5 border-l-4 border-l-amber-500 shadow-2xs">
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-dark-300 block">Avg Cost / Developer</span>
            <div className="text-xl font-bold text-dark-100 mt-0.5">
              ${(summaryData?.summary?.avg_cost_per_dev ?? 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-dark-400">Monthly budget headroom: ~$45</span>
          </div>
        </div>
      </div>

      {/* Analytics Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Token & Spend Trend */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] lg:col-span-2 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-dark-100 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary-600" />
                Daily AI Spend & Token Velocity
              </h2>
              <p className="text-[11px] text-dark-300">Daily cost in USD across all developer sessions</p>
            </div>
          </div>

          <div className="h-60 w-full">
            {summaryData?.daily_trend && summaryData.daily_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summaryData.daily_trend}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                    formatter={(val: number | string | Array<number | string> | undefined) => [
                      `$${Number(val || 0).toFixed(4)}`,
                      'Daily Cost',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost_usd"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#costGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-dark-400">
                No activity recorded in selected timeframe.
              </div>
            )}
          </div>
        </div>

        {/* Tool & Client Distribution */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 space-y-4 shadow-2xs">
          <div>
            <h2 className="text-sm font-bold text-dark-100 flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary-600" />
              Tool & Client Attribution
            </h2>
            <p className="text-[11px] text-dark-300">Share of token volume by developer client</p>
          </div>

          <div className="h-44 w-full">
            {summaryData?.tool_breakdown && summaryData.tool_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summaryData.tool_breakdown}
                    dataKey="tokens"
                    nameKey="tool_name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {summaryData.tool_breakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={TOOL_COLORS[entry.tool_name] || DEFAULT_COLOR}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number | string | Array<number | string> | undefined) => [
                      formatTokens(Number(v || 0)),
                      'Tokens',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-dark-400">
                No tools data available
              </div>
            )}
          </div>

          {/* Tool legend list */}
          <div className="space-y-1.5 pt-2 border-t border-slate-150">
            {(summaryData?.tool_breakdown ?? []).length === 0 ? (
              <p className="text-[11px] text-dark-400 text-center py-2">
                No external tool activity recorded yet. Click "Connect Dev Tools" to configure CLI or gateway hooks.
              </p>
            ) : (
              (summaryData?.tool_breakdown ?? []).map((t) => (
                <div key={t.tool_name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: TOOL_COLORS[t.tool_name] || DEFAULT_COLOR }}
                    />
                    <span className="font-medium text-dark-200">{t.tool_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-dark-100 font-semibold">{formatTokens(t.tokens)}</span>
                    <span className="text-[10px] text-dark-400 block">${t.cost_usd.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Employee Attribution Leaderboard Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-dark-100 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-600" />
              Employee AI Token & Budget Attribution
            </h2>
            <p className="text-[11px] text-dark-300">
              Detailed tracking per developer with customizable monthly allowances and guardrails.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-dark-400" />
            <Input
              placeholder="Search employee or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-[#E5E7EB] text-dark-300 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Employee</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Total Tokens</th>
                <th className="py-2.5 px-4">Prompt / Completion</th>
                <th className="py-2.5 px-4">Total Cost</th>
                <th className="py-2.5 px-4">Monthly Quota</th>
                <th className="py-2.5 px-4">Guardrail</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 bg-white">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-dark-400">
                    No employees matching search query.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const pct = emp.budget_used_percentage;
                  const isExceeded = pct >= 100;
                  const isWarning = pct >= 80 && pct < 100;

                  return (
                    <tr key={emp.user_id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-dark-100">{emp.name}</div>
                            <div className="text-[10px] text-dark-400 font-mono">{emp.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-dark-300 border border-slate-200">
                          {emp.role}
                        </span>
                      </td>

                      {/* Total Tokens */}
                      <td className="py-3 px-4 font-mono font-bold text-dark-100">
                        {formatTokens(emp.total_tokens)}
                      </td>

                      {/* Prompt / Completion */}
                      <td className="py-3 px-4 font-mono text-[11px] text-dark-300">
                        {formatTokens(emp.prompt_tokens)} / {formatTokens(emp.completion_tokens)}
                      </td>

                      {/* Cost */}
                      <td className="py-3 px-4 font-mono font-bold text-dark-100">
                        ${emp.total_cost_usd.toFixed(4)}
                      </td>

                      {/* Quota Progress */}
                      <td className="py-3 px-4 min-w-[140px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-semibold text-dark-200">${emp.total_cost_usd.toFixed(2)}</span>
                            <span className="text-dark-400">of ${emp.monthly_cost_limit.toFixed(2)} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-150 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isExceeded
                                  ? 'bg-rose-500'
                                  : isWarning
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Guardrail Status */}
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            isExceeded
                              ? 'danger'
                              : isWarning
                              ? 'warning'
                              : 'success'
                          }
                        >
                          {emp.budget_status} ({emp.enforcement_action})
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenQuotaModal(emp)}
                          className="text-[11px] h-7 px-2.5 flex items-center gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          Set Quota
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Quota Modal */}
      {selectedEmployee && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedEmployee(null)}
          title={`Set AI Budget Quota: ${selectedEmployee.name}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-dark-300">
              Configure monthly token and cost limits for <strong>{selectedEmployee.email}</strong>. Once reached,
              DevOpsPulse can notify admins or temporarily pause high-cost models.
            </p>

            <div>
              <label className="block font-semibold text-dark-100 mb-1">Monthly Budget Limit (USD $)</label>
              <Input
                type="number"
                min={1}
                max={5000}
                value={costLimitInput}
                onChange={(e) => setCostLimitInput(Number(e.target.value))}
                className="text-xs"
              />
              <span className="text-[10px] text-dark-400 mt-0.5 block">Recommended: $30 to $100 per developer/month.</span>
            </div>

            <div>
              <label className="block font-semibold text-dark-100 mb-1">Monthly Token Ceiling</label>
              <Input
                type="number"
                min={100000}
                step={500000}
                value={tokenLimitInput}
                onChange={(e) => setTokenLimitInput(Number(e.target.value))}
                className="text-xs"
              />
              <span className="text-[10px] text-dark-400 mt-0.5 block">Default: 5,000,000 tokens/month.</span>
            </div>

            <div>
              <label className="block font-semibold text-dark-100 mb-1">Guardrail Enforcement Action</label>
              <select
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value as 'NOTIFY' | 'BLOCK')}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="NOTIFY">NOTIFY (Send alert when limit is exceeded, do not block)</option>
                <option value="BLOCK">BLOCK (Hard block expensive models once ceiling is crossed)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-150">
              <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveQuota} disabled={savingQuota}>
                {savingQuota ? 'Saving...' : 'Save Guardrail'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Connect Dev Tools (Universal Gateway & Ingestion Modal) */}
      {showIngestModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowIngestModal(false)}
          title="Connect Cursor, Claude Code, & Codex to AI Governance"
        >
          <div className="space-y-4 text-xs">
            <p className="text-dark-300">
              DevOpsPulse acts as your company's central AI Gateway. Developers use their standard tools without change, while tokens and costs are automatically attributed and audited in real time.
            </p>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 gap-1 pb-1">
              {[
                { id: 'cursor', label: 'Cursor IDE (Easiest)' },
                { id: 'claude', label: 'Claude Code CLI' },
                { id: 'codex', label: 'OpenAI / Codex' },
                { id: 'rest', label: 'REST Ingest' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveGuideTab(tab.id as 'cursor' | 'claude' | 'codex' | 'rest')}
                  className={`px-3 py-1.5 rounded-t-lg font-medium text-[11px] transition-colors ${
                    activeGuideTab === tab.id
                      ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                      : 'text-dark-300 hover:text-dark-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Cursor IDE */}
            {activeGuideTab === 'cursor' && (
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] text-blue-900">
                  <strong>Zero-Code Setup:</strong> Developers paste this URL in Cursor Settings. Every AI completion is streamed and attributed to their corporate account.
                </div>

                <div>
                  <span className="font-semibold text-dark-100 block mb-1">1. Cursor Settings ➔ Models ➔ Override OpenAI Base URL:</span>
                  <div className="relative group">
                    <pre className="p-2.5 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                      http://localhost:8000/api/v1/ai-governance/proxy/v1
                    </pre>
                    <button
                      onClick={() => handleCopy('http://localhost:8000/api/v1/ai-governance/proxy/v1', 'cursor_url')}
                      className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedSnippet === 'cursor_url' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedSnippet === 'cursor_url' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-dark-100 block mb-1">2. Developer API Key in Cursor:</span>
                  <p className="text-[11px] text-dark-400">
                    Developers can enter their corporate email or employee access token as the API key in Cursor.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Claude Code CLI */}
            {activeGuideTab === 'claude' && (
              <div className="space-y-3">
                <p className="text-[11px] text-dark-300">
                  Add this environment variable to your terminal session or <code className="bg-slate-100 px-1 py-0.5 rounded">~/.bashrc</code>:
                </p>

                <div className="relative group">
                  <pre className="p-3 rounded-lg bg-slate-900 text-amber-400 font-mono text-[11px] overflow-x-auto">
{`export ANTHROPIC_BASE_URL="http://localhost:8000/api/v1/ai-governance/proxy"
export ANTHROPIC_API_KEY="devopspulse-user-token"`}
                  </pre>
                  <button
                    onClick={() =>
                      handleCopy(
                        'export ANTHROPIC_BASE_URL="http://localhost:8000/api/v1/ai-governance/proxy"\nexport ANTHROPIC_API_KEY="devopspulse-user-token"',
                        'claude_env'
                      )
                    }
                    className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1"
                  >
                    {copiedSnippet === 'claude_env' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedSnippet === 'claude_env' ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <p className="text-[11px] text-dark-400">
                  Now running <code className="font-mono text-dark-200">claude</code> will stream responses and log all input and output tokens directly to your enterprise dashboard.
                </p>
              </div>
            )}

            {/* Tab 3: OpenAI / Codex */}
            {activeGuideTab === 'codex' && (
              <div className="space-y-3">
                <p className="text-[11px] text-dark-300">
                  Configure the OpenAI Python SDK, Codex scripts, or CLI assistants:
                </p>

                <div className="relative group">
                  <pre className="p-3 rounded-lg bg-slate-900 text-blue-400 font-mono text-[11px] overflow-x-auto">
{`export OPENAI_BASE_URL="http://localhost:8000/api/v1/ai-governance/proxy/v1"
export OPENAI_API_KEY="devopspulse-user-token"`}
                  </pre>
                  <button
                    onClick={() =>
                      handleCopy(
                        'export OPENAI_BASE_URL="http://localhost:8000/api/v1/ai-governance/proxy/v1"\nexport OPENAI_API_KEY="devopspulse-user-token"',
                        'codex_env'
                      )
                    }
                    className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1"
                  >
                    {copiedSnippet === 'codex_env' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedSnippet === 'codex_env' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* Tab 4: Direct REST Ingestion */}
            {activeGuideTab === 'rest' && (
              <div className="space-y-3">
                <p className="text-[11px] text-dark-300">
                  Push token telemetry from custom CI/CD jobs, company gateways, or post-execution hooks:
                </p>

                <div className="space-y-1">
                  <span className="font-semibold text-dark-100 block">POST Endpoint:</span>
                  <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px]">
                    POST http://localhost:8000/api/v1/ai-governance/ingest
                  </pre>
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-dark-100 block">Sample Payload:</span>
                  <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
{`{
  "tool_name": "Claude Code",
  "provider": "anthropic",
  "model_name": "claude-3-5-sonnet",
  "prompt_tokens": 14200,
  "completion_tokens": 3100,
  "user_email": "developer@company.com"
}`}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-150">
              <Button size="sm" onClick={() => setShowIngestModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AIGovernancePage;
