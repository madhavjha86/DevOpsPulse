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
        // Refresh app state
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
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
              <GitMerge className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100">GitOps & Progressive Delivery</h1>
            <Badge variant="info">Declarative CI/CD</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Automated cluster drift reconciliation against Git repositories and real-time canary / blue-green traffic management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => handleSync(true)} disabled={syncing}>
            Dry-Run Diff
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleSync(false)}
            disabled={syncing}
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
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
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-xs text-cyan-300 flex items-center justify-between">
          <span>{syncMessage}</span>
          <button onClick={() => setSyncMessage(null)} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>
      )}

      {/* App Selector Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {apps.map((app) => (
          <button
            key={app.id}
            onClick={() => handleSelectApp(app)}
            className={`flex items-center gap-2 rounded-xl border p-3.5 text-left transition min-w-[240px] ${
              selectedApp?.id === app.id
                ? 'border-cyan-500 bg-cyan-950/20 text-slate-100 shadow'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
            }`}
          >
            <GitBranch className="h-4 w-4 shrink-0 text-cyan-400" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 truncate">{app.name}</span>
                <Badge variant={app.sync_status === 'Synced' ? 'success' : 'warning'}>
                  {app.sync_status}
                </Badge>
              </div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                {app.cluster_name} / {app.namespace}
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedApp && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Drift Inspector & Revisions (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  Cluster State vs Git Desired State
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Synced: {new Date(selectedApp.last_synced_at).toLocaleTimeString()}
                </span>
              </div>

              {/* Revision Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Git Desired Revision</span>
                  <div className="text-xs font-mono font-bold text-cyan-400 mt-1">
                    {selectedApp.target_revision}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                    {selectedApp.git_repo} ({selectedApp.git_branch})
                  </span>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Live Cluster Revision</span>
                  <div className="text-xs font-mono font-bold text-slate-200 mt-1">
                    {selectedApp.live_revision}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                    Cluster: {selectedApp.cluster_name}
                  </span>
                </div>
              </div>

              {/* Drift Table */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Active Configuration Drift Diff ({selectedApp.drifts.length})
                </h4>

                {selectedApp.drifts.length === 0 ? (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-4 text-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-emerald-300">Zero Drift Detected</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Live cluster configuration is 100% synchronized with the Git repository.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase tracking-wider">
                          <th className="py-2 px-3">Resource & Field</th>
                          <th className="py-2 px-3">Git Value</th>
                          <th className="py-2 px-3">Live Cluster</th>
                          <th className="py-2 px-3">Severity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                        {selectedApp.drifts.map((d, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30 font-mono text-[11px]">
                            <td className="py-2 px-3">
                              <span className="text-slate-200 font-semibold">{d.resource_kind}/{d.resource_name}</span>
                              <div className="text-cyan-400/80">{d.diff_field}</div>
                            </td>
                            <td className="py-2 px-3 text-emerald-400">{d.git_value}</td>
                            <td className="py-2 px-3 text-rose-400">{d.live_k8s_value}</td>
                            <td className="py-2 px-3 font-sans">
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
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-cyan-400" />
                    Canary Traffic Controller
                  </h3>
                  <Badge variant={canary.status === 'RUNNING' ? 'info' : canary.status === 'PROMOTED' ? 'success' : 'danger'}>
                    {canary.status}
                  </Badge>
                </div>

                {/* Traffic Split Display */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-cyan-400">Canary: {canary.canary_weight}%</span>
                    <span className="text-slate-400">Baseline: {canary.baseline_weight}%</span>
                  </div>

                  {/* Dual color progress bar */}
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      style={{ width: `${canary.canary_weight}%` }}
                      className="bg-cyan-500 transition-all duration-300"
                    />
                    <div
                      style={{ width: `${canary.baseline_weight}%` }}
                      className="bg-slate-600 transition-all duration-300"
                    />
                  </div>
                </div>

                {/* Slider input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">
                    Adjust Traffic Weight (% to Canary):
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={sliderWeight}
                    onChange={(e) => setSliderWeight(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>0% (Off)</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100% (Promote)</span>
                  </div>
                </div>

                {/* Telemetry Comparison Table */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3">
                    <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-1">
                      Canary ({canary.canary_weight}%)
                    </span>
                    <div className="text-[11px] text-slate-300 font-mono truncate">
                      {canary.canary_image.split('/').pop()}
                    </div>
                    <div className="mt-2 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">5xx Error Rate:</span>
                        <span className="text-emerald-400 font-semibold font-mono">
                          {(canary.http_error_rate_canary * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">p99 Latency:</span>
                        <span className="text-slate-200 font-semibold font-mono">
                          {canary.p99_latency_canary_ms}ms
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Baseline ({canary.baseline_weight}%)
                    </span>
                    <div className="text-[11px] text-slate-300 font-mono truncate">
                      {canary.baseline_image.split('/').pop()}
                    </div>
                    <div className="mt-2 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">5xx Error Rate:</span>
                        <span className="text-emerald-400 font-semibold font-mono">
                          {(canary.http_error_rate_baseline * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">p99 Latency:</span>
                        <span className="text-slate-200 font-semibold font-mono">
                          {canary.p99_latency_baseline_ms}ms
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Control Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleCanaryAction('SET_WEIGHT')}
                    disabled={adjustingCanary}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
                  >
                    Apply {sliderWeight}% Split
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleCanaryAction('PROMOTE')}
                    disabled={adjustingCanary}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Promote (100%)
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleCanaryAction('ROLLBACK')}
                    disabled={adjustingCanary}
                    className="text-xs"
                  >
                    Rollback (0%)
                  </Button>
                </div>

                {/* Step History Log */}
                {canary.step_history.length > 0 && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Rollout Audit Timeline
                    </span>
                    <ul className="space-y-1 text-[11px] text-slate-400 font-mono">
                      {canary.step_history.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-cyan-400">•</span>
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
