import React, { useEffect, useState } from 'react';
import {
  GitMerge,
  GitBranch,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Activity,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Zap,
  Clock,
  Layers,
} from 'lucide-react';
import {
  gitopsApi,
  GitOpsApp,
  CanaryRollout,
  GitOpsSyncResponse,
} from '../services/gitops';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function GitOpsPage() {
  const [apps, setApps] = useState<GitOpsApp[]>([]);
  const [selectedApp, setSelectedApp] = useState<GitOpsApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Canary state
  const [canary, setCanary] = useState<CanaryRollout | null>(null);
  const [sliderWeight, setSliderWeight] = useState<number>(20);
  const [adjustingCanary, setAdjustingCanary] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const appList = await gitopsApi.listApps();
      setApps(appList);
      if (appList.length > 0) {
        const primary = appList[0];
        setSelectedApp(primary);
        const canaryData = await gitopsApi.getCanary(primary.id);
        setCanary(canaryData);
        setSliderWeight(canaryData.canary_weight);
      }
    } catch (err) {
      console.error('Failed to load GitOps data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectApp = async (app: GitOpsApp) => {
    setSelectedApp(app);
    setSyncMessage(null);
    try {
      const canaryData = await gitopsApi.getCanary(app.id);
      setCanary(canaryData);
      setSliderWeight(canaryData.canary_weight);
    } catch (err) {
      console.error('Failed to get canary state', err);
    }
  };

  const handleSync = async (dryRun = false) => {
    if (!selectedApp) return;
    try {
      setSyncing(true);
      const res: GitOpsSyncResponse = await gitopsApi.syncApp(selectedApp.id, { dry_run: dryRun });
      setSyncMessage(res.message);
      if (!dryRun) {
        const updated = await gitopsApi.getApp(selectedApp.id);
        setSelectedApp(updated);
        setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      }
    } catch (err: any) {
      setSyncMessage(err?.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleCanaryAction = async (action: 'SET_WEIGHT' | 'PROMOTE' | 'ROLLBACK') => {
    if (!selectedApp) return;
    try {
      setAdjustingCanary(true);
      const updated = await gitopsApi.adjustCanary(selectedApp.id, {
        action,
        weight: sliderWeight,
      });
      setCanary(updated);
      setSliderWeight(updated.canary_weight);
    } catch (err) {
      console.error('Failed to adjust canary', err);
    } finally {
      setAdjustingCanary(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 shadow-sm">
              <GitMerge className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  GitOps & Progressive Delivery
                </h1>
                <Badge variant="info">Declarative CI/CD</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Automated cluster drift reconciliation against Git repositories and real-time canary / blue-green traffic management.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="secondary" onClick={() => handleSync(true)} disabled={syncing}>
            Dry-Run Diff
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleSync(false)}
            disabled={syncing}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-sm"
          >
            {syncing ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                1-Click Git Reconcile
              </>
            )}
          </Button>
        </div>
      </div>

      {syncMessage && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50/80 p-4 text-xs text-cyan-900 font-medium flex items-center justify-between shadow-subtle">
          <span>{syncMessage}</span>
          <button onClick={() => setSyncMessage(null)} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}

      {/* App Selector Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {apps.map((app) => {
          const isSelected = selectedApp?.id === app.id;
          return (
            <button
              key={app.id}
              onClick={() => handleSelectApp(app)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition min-w-[260px] shadow-subtle ${
                isSelected
                  ? 'border-[#7C3AED] bg-purple-50/50 ring-2 ring-[#7C3AED]/15'
                  : 'border-[#E5E7EB] bg-white hover:border-slate-300'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-purple-100 text-[#7C3AED]' : 'bg-slate-100 text-slate-600'}`}>
                <GitBranch className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900 truncate">{app.name}</span>
                  <Badge variant={app.sync_status === 'Synced' ? 'success' : 'warning'}>
                    {app.sync_status}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                  {app.cluster_name} / {app.namespace}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedApp && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Drift Inspector & Revisions (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#7C3AED]" />
                  <span>Cluster State vs Git Desired State</span>
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Synced: {new Date(selectedApp.last_synced_at).toLocaleTimeString()}
                </span>
              </div>

              {/* Revision Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Git Desired Revision
                  </span>
                  <div className="text-sm font-mono font-bold text-[#7C3AED] mt-1">
                    {selectedApp.target_revision}
                  </div>
                  <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                    {selectedApp.git_repo} ({selectedApp.git_branch})
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Live Cluster Revision
                  </span>
                  <div className="text-sm font-mono font-bold text-slate-800 mt-1">
                    {selectedApp.live_revision}
                  </div>
                  <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                    Cluster: {selectedApp.cluster_name}
                  </span>
                </div>
              </div>

              {/* Drift Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Active Configuration Drift Diff ({selectedApp.drifts.length})
                </h4>

                {selectedApp.drifts.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 text-center">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-emerald-800">Zero Drift Detected</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Live cluster configuration is 100% synchronized with the Git repository.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">Resource & Field</th>
                          <th className="py-2.5 px-3">Git Desired</th>
                          <th className="py-2.5 px-3">Live Cluster</th>
                          <th className="py-2.5 px-3">Severity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedApp.drifts.map((d, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 font-mono text-[11px]">
                            <td className="py-2.5 px-3">
                              <span className="text-slate-900 font-bold font-sans block">{d.resource_kind}/{d.resource_name}</span>
                              <span className="text-slate-500">{d.diff_field}</span>
                            </td>
                            <td className="py-2.5 px-3 text-emerald-700 font-bold bg-emerald-50/30">{d.git_value}</td>
                            <td className="py-2.5 px-3 text-rose-700 font-bold bg-rose-50/30">{d.live_k8s_value}</td>
                            <td className="py-2.5 px-3 font-sans">
                              <Badge variant={d.severity === 'critical' ? 'danger' : 'warning'}>
                                {d.severity}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Progressive Delivery & Canary Traffic Slider (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {canary && (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-subtle space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-[#7C3AED]" />
                    <span>Canary Traffic Controller</span>
                  </h3>
                  <Badge variant={canary.status === 'RUNNING' ? 'info' : canary.status === 'PROMOTED' ? 'success' : 'danger'}>
                    {canary.status}
                  </Badge>
                </div>

                {/* Traffic Split Display */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[#7C3AED]">Canary (New): {canary.canary_weight}%</span>
                    <span className="text-slate-600">Baseline (Stable): {canary.baseline_weight}%</span>
                  </div>

                  {/* Dual color progress bar */}
                  <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
                    <div
                      style={{ width: `${canary.canary_weight}%` }}
                      className="bg-gradient-to-r from-[#7C3AED] to-purple-500 rounded-full transition-all duration-300"
                    />
                    <div
                      style={{ width: `${canary.baseline_weight}%` }}
                      className="bg-slate-300 rounded-full transition-all duration-300 ml-0.5"
                    />
                  </div>
                </div>

                {/* Slider input */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Adjust Traffic Weight (% to Canary):
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={sliderWeight}
                    onChange={(e) => setSliderWeight(Number(e.target.value))}
                    className="w-full accent-[#7C3AED] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                    <span>0% (Off)</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100% (Promote)</span>
                  </div>
                </div>

                {/* Telemetry Comparison Table */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5">
                    <span className="text-[10px] uppercase font-bold text-[#7C3AED] block mb-1">
                      Canary ({canary.canary_weight}%)
                    </span>
                    <div className="text-xs text-slate-800 font-mono font-bold truncate">
                      {canary.canary_image.split('/').pop()}
                    </div>
                    <div className="mt-2.5 space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">5xx Error Rate:</span>
                        <span className="text-emerald-700 font-bold font-mono">
                          {(canary.http_error_rate_canary * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">p99 Latency:</span>
                        <span className="text-slate-800 font-bold font-mono">
                          {canary.p99_latency_canary_ms}ms
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                      Baseline ({canary.baseline_weight}%)
                    </span>
                    <div className="text-xs text-slate-800 font-mono font-bold truncate">
                      {canary.baseline_image.split('/').pop()}
                    </div>
                    <div className="mt-2.5 space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">5xx Error Rate:</span>
                        <span className="text-emerald-700 font-bold font-mono">
                          {(canary.http_error_rate_baseline * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">p99 Latency:</span>
                        <span className="text-slate-800 font-bold font-mono">
                          {canary.p99_latency_baseline_ms}ms
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Control Actions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleCanaryAction('SET_WEIGHT')}
                    disabled={adjustingCanary}
                    className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold"
                  >
                    Apply {sliderWeight}% Split
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleCanaryAction('PROMOTE')}
                    disabled={adjustingCanary}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    Promote (100%)
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleCanaryAction('ROLLBACK')}
                    disabled={adjustingCanary}
                    className="text-xs font-semibold"
                  >
                    Rollback (0%)
                  </Button>
                </div>

                {/* Step History Log */}
                {canary.step_history.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                      Rollout Audit Timeline
                    </span>
                    <ul className="space-y-1 text-[11px] text-slate-600 font-mono">
                      {canary.step_history.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-[#7C3AED] font-bold">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
