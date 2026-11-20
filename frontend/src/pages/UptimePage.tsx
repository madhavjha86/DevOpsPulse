import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Clock,
  Globe,
  Trash2,
  Play,
  ShieldCheck,
  AlertTriangle,
  Flame,
  PhoneCall,
  UserCheck,
  Zap,
} from 'lucide-react';
import { monitorService, Monitor } from '@/services/monitors';
import {
  sreService,
  ReliabilityOverview,
  Slo,
  OnCallSchedule,
  SloType,
} from '@/services/sre';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CountUp } from '@/components/ui/CountUp';

type SreTab = 'slos' | 'oncall' | 'monitors';

export const UptimePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SreTab>('slos');
  const [overview, setOverview] = useState<ReliabilityOverview | null>(null);
  const [slos, setSlos] = useState<Slo[]>([]);
  const [oncallList, setOncallList] = useState<OnCallSchedule[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isSloModalOpen, setIsSloModalOpen] = useState<boolean>(false);
  const [isOnCallModalOpen, setIsOnCallModalOpen] = useState<boolean>(false);
  const [isMonitorModalOpen, setIsMonitorModalOpen] = useState<boolean>(false);

  // Probe & action states
  const [probingId, setProbingId] = useState<number | null>(null);
  const [burningId, setBurningId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New SLO form
  const [sloName, setSloName] = useState('');
  const [sloService, setSloService] = useState('api-gateway');
  const [sloType, setSloType] = useState<SloType>('AVAILABILITY');
  const [sloTarget, setSloTarget] = useState(99.9);
  const [contractualSla, setContractualSla] = useState(99.5);
  const [warningThreshold, setWarningThreshold] = useState(20.0);
  const [sloDesc, setSloDesc] = useState('');
  const [isSubmittingSlo, setIsSubmittingSlo] = useState(false);

  // New On-call form
  const [oncallName, setOncallName] = useState('Production Core Rotation');
  const [primaryEng, setPrimaryEng] = useState('');
  const [secondaryEng, setSecondaryEng] = useState('');
  const [rotationType, setRotationType] = useState('WEEKLY');
  const [escalationPolicy, setEscalationPolicy] = useState('P1: 5min Slack -> SMS -> Team Lead -> VP');
  const [handoffDay, setHandoffDay] = useState('Monday');
  const [isSubmittingOncall, setIsSubmittingOncall] = useState(false);

  // New Monitor form
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [isSubmittingMonitor, setIsSubmittingMonitor] = useState(false);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [ovRes, slosRes, oncallRes, monRes] = await Promise.all([
        sreService.getOverview(),
        sreService.listSlos(),
        sreService.listOnCall(),
        monitorService.list(),
      ]);
      setOverview(ovRes.data);
      setSlos(slosRes.data);
      setOncallList(oncallRes.data);
      setMonitors(monRes.data);
    } catch (err) {
      console.error('Failed to load SRE data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAllData();
  }, []);

  const handleCreateSlo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSlo(true);
    setStatusMessage(null);
    try {
      await sreService.createSlo({
        name: sloName,
        service_name: sloService,
        sli_type: sloType,
        target_percentage: Number(sloTarget),
        contractual_sla_percentage: Number(contractualSla),
        warning_threshold: Number(warningThreshold),
        description: sloDesc,
      });
      setIsSloModalOpen(false);
      setSloName('');
      setSloDesc('');
      setStatusMessage({ type: 'success', text: `Created SLO: ${sloName} successfully.` });
      await fetchAllData();
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to define Service Level Objective.' });
    } finally {
      setIsSubmittingSlo(false);
    }
  };

  const handleSimulateBurn = async (sloId: number) => {
    setBurningId(sloId);
    setStatusMessage(null);
    try {
      const res = await sreService.simulateBurn(sloId, {
        burn_rate_multiplier: 7.5,
        reduce_budget_percent: 35.0,
      });
      setStatusMessage({
        type: 'success',
        text: `Simulated error surge on ${res.data.name}: 1h burn rate spiked to ${res.data.error_budget_burn_rate_1h}x, remaining budget: ${res.data.error_budget_remaining_percentage}%.`,
      });
      await fetchAllData();
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to simulate error surge.' });
    } finally {
      setBurningId(null);
    }
  };

  const handleCreateOnCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingOncall(true);
    setStatusMessage(null);
    try {
      await sreService.createOnCall({
        name: oncallName,
        primary_engineer: primaryEng,
        secondary_engineer: secondaryEng,
        rotation_type: rotationType,
        escalation_policy: escalationPolicy,
        handoff_day: handoffDay,
      });
      setIsOnCallModalOpen(false);
      setPrimaryEng('');
      setSecondaryEng('');
      setStatusMessage({ type: 'success', text: `Registered on-call roster: ${oncallName}.` });
      await fetchAllData();
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to create on-call roster.' });
    } finally {
      setIsSubmittingOncall(false);
    }
  };

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingMonitor(true);
    try {
      await monitorService.create({
        name,
        url,
        method,
        interval_seconds: Number(intervalSeconds),
      });
      setIsMonitorModalOpen(false);
      setName('');
      setUrl('');
      await fetchAllData();
    } catch {
      alert('Failed to register monitor.');
    } finally {
      setIsSubmittingMonitor(false);
    }
  };

  const handleProbe = async (id: number) => {
    setProbingId(id);
    setStatusMessage(null);
    try {
      const res = await monitorService.probe(id);
      setStatusMessage({
        type: 'success',
        text: `Probe result: HTTP ${res.data.status_code} (${res.data.latency_ms}ms) — ${res.data.message || (res.data.is_up ? 'Operational' : 'Down')}`,
      });
      await fetchAllData();
    } catch {
      setStatusMessage({ type: 'error', text: 'Probe request failed.' });
    } finally {
      setProbingId(null);
    }
  };

  const handleDeleteMonitor = async (id: number) => {
    if (!window.confirm('Delete this service monitor?')) return;
    try {
      await monitorService.delete(id);
      await fetchAllData();
    } catch {
      alert('Delete failed.');
    }
  };

  if (isLoading && !overview) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100">
              SRE & Reliability Engineering
            </h1>
            {overview && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {overview.overall_uptime_percentage}% System Uptime
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-dark-400 mt-1">
            Service Level Objectives (SLO), Contractual SLAs, Error Budget Burn Rates, and On-Call Rotations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => setIsOnCallModalOpen(true)}
            leftIcon={<PhoneCall className="h-4 w-4 text-primary-600" />}
          >
            Manage On-Call
          </Button>

          <Button
            variant="primary"
            onClick={() => setIsSloModalOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Define SLO Target
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-xl border p-3.5 text-xs font-medium flex items-center justify-between shadow-2xs ${
            statusMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold ml-2 hover:opacity-75">
            ×
          </button>
        </div>
      )}

      {/* SRE Executive Scorecard (4 KPI Cards) */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">System Availability</span>
              <Activity className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">
              <CountUp value={overview.overall_uptime_percentage} suffix="%" />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">
              {overview.slos_meeting_target} of {overview.active_slos_count} SLOs healthy
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Mean Time to Detect (MTTD)</span>
              <Clock className="h-4 w-4 text-primary-600" />
            </div>
            <div className="text-2xl font-extrabold text-dark-100 mt-1">
              <CountUp value={overview.mttd_minutes} suffix=" min" />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">Automated alert correlation</div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Mean Time to Resolve (MTTR)</span>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold text-dark-100 mt-1">
              <CountUp value={overview.mttr_minutes} suffix=" min" />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">Across 30-day incident window</div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Primary On-Call SRE</span>
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-sm font-bold text-dark-100 mt-2 truncate">
              {overview.active_on_call?.primary_engineer || 'Alex Morgan (Staff SRE)'}
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1 truncate">
              Sec: {overview.active_on_call?.secondary_engineer || 'Devon Vance'}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB]">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('slos')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'slos'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Service Level Objectives & Error Budgets
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {slos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('oncall')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'oncall'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <PhoneCall className="h-4 w-4" />
            On-Call Roster & Escalation
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {oncallList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('monitors')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'monitors'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <Globe className="h-4 w-4" />
            Synthetic Endpoint Monitors
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {monitors.length}
            </span>
          </button>
        </nav>
      </div>

      {/* TAB 1: Service Level Objectives & Error Budgets */}
      {activeTab === 'slos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {slos.map((slo) => {
              const remaining = slo.error_budget_remaining_percentage;
              const isWarning = slo.status === 'WARNING';
              const isBreached = slo.status === 'BREACHED';

              return (
                <div
                  key={slo.id}
                  className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {slo.service_name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isBreached
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isWarning
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {slo.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-dark-100 leading-snug">{slo.name}</h3>
                    {slo.description && (
                      <p className="text-xs text-dark-400 line-clamp-2">{slo.description}</p>
                    )}
                  </div>

                  {/* Explicit distinction: Internal SLO Target vs Contractual Customer SLA */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-[#E5E7EB] grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-dark-400 block">Internal SLO</span>
                      <span className="font-extrabold text-primary-700 font-mono text-sm">
                        {slo.target_percentage}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-dark-400 block">Customer SLA</span>
                      <span className="font-bold text-slate-700 font-mono text-sm">
                        {slo.contractual_sla_percentage}%
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-[#E5E7EB] flex items-center justify-between">
                      <span className="text-[11px] text-dark-400">Current 30d SLI:</span>
                      <span className="font-mono font-bold text-emerald-700">{slo.current_sli}%</span>
                    </div>
                  </div>

                  {/* Error Budget Progress Bar & Burn Rate */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-dark-400 flex items-center gap-1">
                        <Flame className="h-3.5 w-3.5 text-amber-500" /> Error Budget Left:
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          remaining < 20 ? 'text-rose-600' : remaining < 50 ? 'text-amber-600' : 'text-emerald-700'
                        }`}
                      >
                        {remaining.toFixed(1)}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-[#E5E7EB]">
                      <div
                        className={`h-full transition-all duration-300 ${
                          remaining < 20 ? 'bg-rose-500' : remaining < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, remaining))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-dark-400 font-mono pt-1">
                      <span>1h Burn: <strong className="text-dark-100">{slo.error_budget_burn_rate_1h}x</strong></span>
                      <span>6h Burn: <strong className="text-dark-100">{slo.error_budget_burn_rate_6h}x</strong></span>
                      <span>24h: <strong className="text-dark-100">{slo.error_budget_burn_rate_24h}x</strong></span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSimulateBurn(slo.id)}
                      disabled={burningId === slo.id}
                      leftIcon={
                        burningId === slo.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Flame className="h-3 w-3 text-amber-600" />
                        )
                      }
                    >
                      {burningId === slo.id ? 'Simulating...' : 'Simulate Error Surge'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: On-Call Roster & Escalation Policies */}
      {activeTab === 'oncall' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {oncallList.map((oc) => (
              <div
                key={oc.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-dark-100">{oc.name}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active Rotation
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-[#E5E7EB]">
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-dark-400 block">Primary Responder</span>
                    <strong className="text-dark-100 text-xs block pt-0.5">{oc.primary_engineer}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-dark-400 block">Secondary / Backup</span>
                    <strong className="text-dark-100 text-xs block pt-0.5">{oc.secondary_engineer}</strong>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider block">
                    Escalation Chain & SLA
                  </span>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-[#E5E7EB] font-mono text-[11px] text-slate-700">
                    {oc.escalation_policy}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-dark-400 pt-1 border-t border-[#F1F5F9]">
                  <span>Cadence: <strong>{oc.rotation_type}</strong></span>
                  <span>Handoff: <strong>{oc.handoff_day}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Synthetic Endpoint Monitors */}
      {activeTab === 'monitors' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-subtle">
            <div>
              <h3 className="text-sm font-bold text-dark-100">Configured Synthetic Ping Probes</h3>
              <p className="text-xs font-medium text-dark-400">
                Automated HTTP endpoint polling and status checks
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsMonitorModalOpen(true)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Monitor
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#E5E7EB] text-dark-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Service Name</th>
                    <th className="py-3 px-4">Target URL</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Interval</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Latency</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {monitors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-dark-400">
                        No synthetic monitors configured yet.
                      </td>
                    </tr>
                  ) : (
                    monitors.map((mon) => (
                      <tr key={mon.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-dark-100">{mon.name}</td>
                        <td className="py-3 px-4 font-mono text-dark-400 max-w-[220px] truncate" title={mon.url}>
                          {mon.url}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">{mon.method}</td>
                        <td className="py-3 px-4 text-dark-400">{mon.interval_seconds}s</td>
                        <td className="py-3 px-4">
                          {mon.status === 'operational' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" /> Operational
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px] bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              <XCircle className="h-3 w-3" /> {mon.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-dark-400">
                          {mon.avg_latency_ms ? `${mon.avg_latency_ms.toFixed(1)}ms` : 'Pending'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleProbe(mon.id)}
                              disabled={probingId === mon.id}
                              leftIcon={
                                probingId === mon.id ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3 text-emerald-600" />
                                )
                              }
                            >
                              Probe
                            </Button>
                            <button
                              onClick={() => handleDeleteMonitor(mon.id)}
                              className="p-1.5 text-dark-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Delete monitor"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Define SLO Modal */}
      <Modal
        isOpen={isSloModalOpen}
        onClose={() => setIsSloModalOpen(false)}
        title="Define Service Level Objective (SLO)"
      >
        <form onSubmit={handleCreateSlo} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">SLO Name</label>
            <input
              type="text"
              value={sloName}
              onChange={(e) => setSloName(e.target.value)}
              placeholder="e.g. Order Processing 99.9% Availability"
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-medium text-dark-100 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Target Service</label>
              <input
                type="text"
                value={sloService}
                onChange={(e) => setSloService(e.target.value)}
                required
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">SLI Metric Type</label>
              <select
                value={sloType}
                onChange={(e) => setSloType(e.target.value as SloType)}
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-medium text-dark-100 focus:outline-hidden"
              >
                <option value="AVAILABILITY">Availability (Uptime %)</option>
                <option value="LATENCY">Latency Percentile</option>
                <option value="ERROR_RATE">Error Rate (&lt; threshold)</option>
                <option value="THROUGHPUT">Throughput / Volume</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">
                Internal Target (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="50"
                max="100"
                value={sloTarget}
                onChange={(e) => setSloTarget(Number(e.target.value))}
                required
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">
                Contractual SLA (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="50"
                max="100"
                value={contractualSla}
                onChange={(e) => setContractualSla(Number(e.target.value))}
                required
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Warning Threshold (% Budget)</label>
            <input
              type="number"
              value={warningThreshold}
              onChange={(e) => setWarningThreshold(Number(e.target.value))}
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Description & Objective</label>
            <textarea
              value={sloDesc}
              onChange={(e) => setSloDesc(e.target.value)}
              rows={2}
              placeholder="State the internal goal and consequences of breaching this SLO"
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-medium text-dark-100 focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsSloModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingSlo}
              leftIcon={isSubmittingSlo ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            >
              {isSubmittingSlo ? 'Creating...' : 'Register SLO'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* On-Call Modal */}
      <Modal
        isOpen={isOnCallModalOpen}
        onClose={() => setIsOnCallModalOpen(false)}
        title="Register On-Call Rotation"
      >
        <form onSubmit={handleCreateOnCall} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Rotation Name</label>
            <input
              type="text"
              value={oncallName}
              onChange={(e) => setOncallName(e.target.value)}
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-medium text-dark-100 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Primary Engineer</label>
              <input
                type="text"
                value={primaryEng}
                onChange={(e) => setPrimaryEng(e.target.value)}
                placeholder="e.g. Alex Morgan"
                required
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-medium text-dark-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Secondary Engineer</label>
              <input
                type="text"
                value={secondaryEng}
                onChange={(e) => setSecondaryEng(e.target.value)}
                placeholder="e.g. Devon Vance"
                required
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-medium text-dark-100 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Escalation Policy</label>
            <input
              type="text"
              value={escalationPolicy}
              onChange={(e) => setEscalationPolicy(e.target.value)}
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsOnCallModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingOncall}
              leftIcon={isSubmittingOncall ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5" />}
            >
              {isSubmittingOncall ? 'Saving...' : 'Save Rotation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Monitor Modal */}
      <Modal
        isOpen={isMonitorModalOpen}
        onClose={() => setIsMonitorModalOpen(false)}
        title="Add Synthetic Endpoint Monitor"
      >
        <form onSubmit={handleCreateMonitor} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Endpoint Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Public Healthcheck"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">URL Target</label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.domain.com/health"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">HTTP Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-medium text-dark-100 focus:outline-hidden"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Interval (seconds)</label>
              <Input
                type="number"
                min="10"
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsMonitorModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingMonitor}
            >
              {isSubmittingMonitor ? 'Saving...' : 'Add Monitor'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UptimePage;
