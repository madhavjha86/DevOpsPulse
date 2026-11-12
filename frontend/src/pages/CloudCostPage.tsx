import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Cloud,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Check,
  X,
  Info,
} from 'lucide-react';
import {
  cloudCostService,
  CloudCostOverview,
  Budget,
  CostOptimization,
} from '@/services/cloudCost';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

export const CloudCostPage: React.FC = () => {
  const [overview, setOverview] = useState<CloudCostOverview | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [optimizations, setOptimizations] = useState<CostOptimization[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);

  // Budget Modal
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState<boolean>(false);
  const [budgetName, setBudgetName] = useState<string>('');
  const [budgetProvider, setBudgetProvider] = useState<string>('ALL');
  const [budgetAmount, setBudgetAmount] = useState<string>('2000');
  const [warningThreshold, setWarningThreshold] = useState<string>('80');
  const [alertEmail, setAlertEmail] = useState<string>('');
  const [isSubmittingBudget, setIsSubmittingBudget] = useState<boolean>(false);

  const fetchData = async () => {
    setError(null);
    try {
      const [overviewData, budgetData, optData] = await Promise.all([
        cloudCostService.getOverview(selectedProvider),
        cloudCostService.listBudgets(),
        cloudCostService.listOptimizations('OPEN'),
      ]);
      setOverview(overviewData);
      setBudgets(budgetData);
      setOptimizations(optData);
    } catch {
      setError('Failed to load cloud cost intelligence data.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProvider]);

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetName.trim() || !budgetAmount) return;

    setIsSubmittingBudget(true);
    try {
      await cloudCostService.createBudget({
        name: budgetName.trim(),
        provider: budgetProvider,
        monthly_budget: parseFloat(budgetAmount),
        warning_threshold: parseFloat(warningThreshold),
        alert_email: alertEmail.trim() || undefined,
      });
      setIsBudgetModalOpen(false);
      setBudgetName('');
      setAlertEmail('');
      await fetchData();
    } catch {
      alert('Failed to create cloud budget.');
    } finally {
      setIsSubmittingBudget(false);
    }
  };

  const handleDeleteBudget = async (id: number) => {
    if (!confirm('Are you sure you want to delete this cloud budget?')) return;
    try {
      await cloudCostService.deleteBudget(id);
      await fetchData();
    } catch {
      alert('Failed to remove budget.');
    }
  };

  const handleApplyOptimization = async (id: number) => {
    try {
      await cloudCostService.applyOptimization(id);
      setOptimizations((prev) => prev.filter((o) => o.id !== id));
      if (overview) {
        setOverview({
          ...overview,
          optimizations_count: Math.max(0, overview.optimizations_count - 1),
        });
      }
    } catch {
      alert('Failed to mark optimization as applied.');
    }
  };

  const handleDismissOptimization = async (id: number) => {
    try {
      await cloudCostService.dismissOptimization(id);
      setOptimizations((prev) => prev.filter((o) => o.id !== id));
    } catch {
      alert('Failed to dismiss optimization.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#7C3AED]">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Cloud Cost Intelligence
            </h1>
            <p className="text-sm text-slate-500">
              Multi-cloud billing analytics, budget threshold guardrails, and automated waste reduction
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Provider Filter */}
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="text-xs font-semibold rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          >
            <option value="ALL">All Cloud Providers</option>
            <option value="AWS">Amazon Web Services</option>
            <option value="AZURE">Microsoft Azure</option>
            <option value="GCP">Google Cloud Platform</option>
          </select>

          <Button
            onClick={() => setIsBudgetModalOpen(true)}
            className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-sm text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Set Budget</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Demo Mode or Connector Disclaimer Banner */}
      {overview?.is_demo_mode && (
        <div className="p-3.5 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between text-xs text-purple-900">
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 text-[#7C3AED] shrink-0" />
            <span>
              <strong>Demonstration Mode:</strong> Showing representative multi-cloud billing models. Real AWS Cost Explorer, Azure Cost Management, and GCP BigQuery connectors can be authenticated under Settings.
            </span>
          </div>
        </div>
      )}

      {/* Provider Connectivity Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {overview?.providers.map((p) => {
          const isNotConfigured = p.status === 'NOT_CONFIGURED';
          const isDemo = p.status === 'DEMO_MODE';
          return (
            <div key={p.provider} className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Cloud className="h-5 w-5 text-slate-600" />
                  <span className="text-sm font-bold text-slate-900">{p.provider}</span>
                </div>
                {isNotConfigured ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Not Configured
                  </span>
                ) : isDemo ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    Demo Mode
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Connected
                  </span>
                )}
              </div>

              <div className="mt-3">
                <div className="text-xl font-bold text-slate-900">
                  {isNotConfigured ? (
                    <span className="text-slate-400 font-normal text-sm">Integration Inactive</span>
                  ) : (
                    `$${p.monthly_spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {p.details || (isNotConfigured ? 'Distinguished from zero cost — configure credentials to ingest spend.' : 'Monthly billing synced')}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Level Metric Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="text-xs font-semibold text-slate-500">Total Monthly Spend (MTD)</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            ${overview ? overview.total_monthly_spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600">
            <TrendingDown className="h-3.5 w-3.5" />
            <span>{overview?.monthly_change_percent.toFixed(1)}% vs last month</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="text-xs font-semibold text-slate-500">Projected Month-End Spend</div>
          <div className="mt-2 text-2xl font-bold text-purple-700">
            ${overview ? overview.projected_month_end.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Forecast based on 30-day velocity
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="text-xs font-semibold text-slate-500">Potential Monthly Savings</div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">
            ${overview ? overview.total_potential_savings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{overview?.optimizations_count || 0} waste recommendations</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="text-xs font-semibold text-slate-500">Active Budget Thresholds</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {budgets.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {budgets.filter((b) => b.status === 'OK').length} healthy,{' '}
            {budgets.filter((b) => b.status !== 'OK').length} near limit
          </div>
        </div>
      </div>

      {/* Main Grid: Left Service Breakdown / Right Daily Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Breakdown */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#7C3AED]" />
            <span>Service-Wise Cost Distribution</span>
          </h3>

          <div className="space-y-3.5">
            {overview?.top_services.map((svc) => (
              <div key={svc.service_name} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-800">{svc.service_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({svc.provider})</span>
                  </div>
                  <div className="text-slate-900">
                    ${svc.amount.toFixed(2)}{' '}
                    <span className="text-slate-400 font-normal">({svc.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#7C3AED] rounded-full transition-all"
                    style={{ width: `${Math.min(100, svc.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Trend Overview */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#7C3AED]" />
            <span>Recent Daily Spend Trend</span>
          </h3>

          <div className="space-y-2">
            {overview?.daily_trend.slice(-7).map((day) => (
              <div
                key={day.date}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 text-xs"
              >
                <span className="font-semibold text-slate-700">{day.date}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">
                    AWS: <strong className="text-slate-700">${day.aws.toFixed(2)}</strong>
                  </span>
                  <span className="text-slate-500">
                    GCP: <strong className="text-slate-700">${day.gcp.toFixed(2)}</strong>
                  </span>
                  <span className="font-bold text-[#7C3AED] bg-white px-2 py-0.5 rounded border border-purple-200">
                    Total: ${day.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Budget & Threshold Monitoring Section */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Configured Cloud Budgets & Guardrails</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated alerts fire when real-time spend exceeds warning or critical thresholds
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setIsBudgetModalOpen(true)}
            className="text-xs bg-purple-50 text-purple-700 hover:bg-purple-100"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            <span>Add Budget</span>
          </Button>
        </div>

        {budgets.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No cloud budgets configured. Click "Add Budget" to establish monthly spending thresholds.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map((b) => {
              const isCrit = b.status === 'CRITICAL';
              const isWarn = b.status === 'WARNING';
              return (
                <div
                  key={b.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{b.name}</h4>
                      <span className="text-[11px] text-slate-500 font-mono">{b.provider} Budget</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isCrit
                            ? 'bg-rose-100 text-rose-800'
                            : isWarn
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {b.status}
                      </span>
                      <button
                        onClick={() => handleDeleteBudget(b.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Delete budget"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1 font-semibold">
                      <span className="text-slate-600">
                        ${b.current_spend.toFixed(2)} / ${b.monthly_budget.toFixed(2)}
                      </span>
                      <span className="text-slate-900 font-bold">{b.percentage_used.toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isCrit ? 'bg-rose-600' : isWarn ? 'bg-amber-500' : 'bg-[#7C3AED]'
                        }`}
                        style={{ width: `${Math.min(100, b.percentage_used)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    <span>Forecast: ${b.forecasted_spend.toFixed(2)}</span>
                    <span>Alert: {b.alert_email || 'Default Slack #devops'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cost Optimization Recommendations */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#7C3AED]" />
              <span>Actionable Cost Optimization Recommendations</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Identified unused resources, over-provisioned instances, and lifecycle savings
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            ${overview?.total_potential_savings.toFixed(2) || '0.00'}/mo recoverable
          </span>
        </div>

        {optimizations.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No pending optimization recommendations. Infrastructure resources are operating efficiently!
          </div>
        ) : (
          <div className="space-y-3">
            {optimizations.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-200 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      {item.provider}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {item.category.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {item.difficulty}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ID: {item.resource_id}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                  <p className="text-xs text-slate-600 font-medium">{item.recommendation}</p>
                </div>

                <div className="flex items-center gap-4 md:border-l md:border-slate-100 md:pl-4 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Potential Savings</div>
                    <div className="text-base font-bold text-emerald-600">
                      +${item.estimated_monthly_savings.toFixed(2)}/mo
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleApplyOptimization(item.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      title="Mark Applied"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      <span>Apply</span>
                    </Button>
                    <button
                      onClick={() => handleDismissOptimization(item.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Budget Modal */}
      <Modal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title="Configure Cloud Spend Budget"
      >
        <form onSubmit={handleCreateBudget} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Budget Name *</label>
            <Input
              value={budgetName}
              onChange={(e) => setBudgetName(e.target.value)}
              placeholder="e.g. Q4 Production Cloud Spend"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Provider Scope</label>
              <select
                value={budgetProvider}
                onChange={(e) => setBudgetProvider(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              >
                <option value="ALL">All Cloud Providers</option>
                <option value="AWS">AWS Only</option>
                <option value="AZURE">Azure Only</option>
                <option value="GCP">GCP Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Budget ($) *</label>
              <Input
                type="number"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="2000"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Warning Threshold (%)</label>
              <Input
                type="number"
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(e.target.value)}
                placeholder="80"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Alert Recipient Email</label>
              <Input
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="devops-oncall@example.com"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsBudgetModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmittingBudget}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs"
            >
              {isSubmittingBudget ? 'Saving...' : 'Create Budget'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
