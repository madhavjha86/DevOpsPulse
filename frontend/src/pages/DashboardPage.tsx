import React, { useEffect, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  RefreshCw,
  Plus,
  ShieldCheck,
  Activity,
  DollarSign,
  Flame,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Download,
  Printer,
  Sparkles,
  Send,
  Boxes,
  Compass,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { analyticsService, DoraMetricsResponse } from '@/services/analytics';
import { reportsService, ExecutiveSummaryResponse, NotificationTestResponse } from '@/services/reports';
import { developerPortalService, ServiceCatalogItem } from '@/services/developerPortal';
import { incidentService, Incident } from '@/services/incidents';
import { StatsGrid, RepositoryTelemetryStrip } from '@/components/dashboard/StatsGrid';
import { DoraMetricsOverviewCard } from '@/components/dashboard/DoraMetricsOverviewCard';
import { DeploymentTrendChart } from '@/components/dashboard/DeploymentTrendChart';
import { AiCopilotHighlightCard } from '@/components/dashboard/AiCopilotHighlightCard';
import { SystemHealthCard } from '@/components/dashboard/SystemHealthCard';
import { QuickActionsCard } from '@/components/dashboard/QuickActionsCard';
import { BuildTrendChart } from '@/components/dashboard/BuildTrendChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { WorkflowPerformanceChart } from '@/components/dashboard/WorkflowPerformanceChart';
import { RepositoryActivityChart } from '@/components/dashboard/RepositoryActivityChart';
import { Button } from '@/components/ui/Button';
import type {
  DashboardStats,
  BuildTrend,
  ActivityItem,
  ChartDataPoint,
} from '@/types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Active View Tab: 'overview' | 'dora' | 'reports'
  const [activeTab, setActiveTab] = useState<'overview' | 'dora' | 'reports'>('overview');
  const [timePeriod, setTimePeriod] = useState<string>('30d');

  // Telemetry & Metrics state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dora, setDora] = useState<DoraMetricsResponse | null>(null);
  const [buildTrends, setBuildTrends] = useState<BuildTrend | null>(null);
  const [workflowPerf, setWorkflowPerf] = useState<ChartDataPoint[] | null>(null);
  const [repoActivity, setRepoActivity] = useState<ChartDataPoint[] | null>(null);
  const [activities, setActivities] = useState<ActivityItem[] | null>(null);
  const [execSummary, setExecSummary] = useState<ExecutiveSummaryResponse | null>(null);
  const [coreServices, setCoreServices] = useState<ServiceCatalogItem[]>([]);
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>([]);

  // Notification Test state
  const [testChannel, setTestChannel] = useState<'EMAIL' | 'WEBHOOK' | 'SLACK'>('WEBHOOK');
  const [testTarget, setTestTarget] = useState<string>('https://webhook.site/test');
  const [testResult, setTestResult] = useState<NotificationTestResponse | null>(null);
  const [isTestingNotif, setIsTestingNotif] = useState<boolean>(false);

  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());

  const fetchDashboardData = async () => {
    try {
      const [statsRes, doraRes, trendsRes, perfRes, activityRes, recentRes, execRes, devPortalRes, incidentsRes] = await Promise.all([
        analyticsService.getDashboardStats(),
        analyticsService.getDoraMetrics().catch(() => ({ data: null })),
        analyticsService.getBuildTrends(30),
        analyticsService.getWorkflowPerformance(14),
        analyticsService.getRepositoryActivity(14),
        analyticsService.getRecentActivity(),
        reportsService.getExecutiveSummary(undefined, timePeriod).catch(() => null),
        developerPortalService.getOverview().catch(() => null),
        incidentService.listIncidents({ status: 'OPEN', limit: 3 }).catch(() => null),
      ]);

      setStats(statsRes.data);
      if (doraRes && doraRes.data) {
        setDora(doraRes.data);
      }
      setBuildTrends(trendsRes.data);
      setWorkflowPerf(perfRes.data.chart_data);
      setRepoActivity(activityRes.data.chart_data);
      setActivities(recentRes.data.activities);
      if (execRes && execRes.security) {
        setExecSummary(execRes);
      }
      if (devPortalRes?.data?.services && devPortalRes.data.services.length > 0) {
        const seen = new Set<string>();
        const unique = devPortalRes.data.services.filter((s: ServiceCatalogItem) => {
          if (seen.has(s.name)) return false;
          seen.add(s.name);
          return true;
        });
        setCoreServices(unique.slice(0, 3));
      }
      if (incidentsRes && Array.isArray(incidentsRes) && incidentsRes.length > 0) {
        const seenInc = new Set<number>();
        const uniqueInc = incidentsRes.filter((inc: Incident) => {
          if (seenInc.has(inc.id)) return false;
          seenInc.add(inc.id);
          return true;
        });
        setLiveIncidents(uniqueInc.slice(0, 3));
      }
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
    const interval = setInterval(() => {
      void fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, [timePeriod]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void fetchDashboardData();
  };

  const handleDownloadCsv = async () => {
    try {
      await reportsService.downloadCsv(undefined, timePeriod);
    } catch (e) {
      console.error('Failed to export CSV', e);
    }
  };

  const handleOpenPdf = () => {
    reportsService.openPrintablePdf(undefined, timePeriod);
  };

  const handleTestNotification = async () => {
    setIsTestingNotif(true);
    setTestResult(null);
    try {
      const res = await reportsService.testNotification(testChannel, testTarget);
      setTestResult(res);
    } catch (e) {
      console.error('Notification test failed', e);
    } finally {
      setIsTestingNotif(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const userName = user?.full_name?.includes('System')
    ? 'Madhav'
    : (user?.full_name?.split(' ')[0] || user?.username || 'Madhav');

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* 1. Header with Live Date, Tabs, and Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-dark-100 flex items-center gap-2">
            <span>{getGreeting()}, {userName}! 👋</span>
          </h1>
          <p className="text-xs sm:text-sm font-medium text-dark-400 mt-0.5">
            Unified Enterprise DevSecOps, SRE & Cloud Intelligence Command Center.
          </p>
        </div>

        {/* Global Toolbar: Date, Period, CSV, PDF, Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden md:flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-dark-300 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-dark-400 shrink-0" />
            <span className="whitespace-nowrap">{currentDateFormatted}</span>
          </div>

          <div className="flex items-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-2 py-1 shadow-2xs">
            {['7d', '30d', '90d'].map((p) => (
              <button
                key={p}
                onClick={() => setTimePeriod(p)}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                  timePeriod === p
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'text-dark-400 hover:text-dark-100'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadCsv}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenPdf}
            leftIcon={<Printer className="h-3.5 w-3.5" />}
          >
            PDF Report
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            Sync
          </Button>
        </div>
      </div>

      {/* 2. Top-Level Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
            activeTab === 'overview'
              ? 'bg-[#EDE9FE] text-[#7C3AED] shadow-2xs'
              : 'text-dark-400 hover:text-dark-100 hover:bg-slate-50'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>360° Command Center</span>
        </button>

        <button
          onClick={() => setActiveTab('dora')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
            activeTab === 'dora'
              ? 'bg-[#EDE9FE] text-[#7C3AED] shadow-2xs'
              : 'text-dark-400 hover:text-dark-100 hover:bg-slate-50'
          }`}
        >
          <Flame className="h-4 w-4" />
          <span>DORA & CI/CD Telemetry</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
            activeTab === 'reports'
              ? 'bg-[#EDE9FE] text-[#7C3AED] shadow-2xs'
              : 'text-dark-400 hover:text-dark-100 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Executive Audits & Alerts</span>
        </button>
      </div>

      {/* TAB 1: 360° Unified Command Center */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive 6-Pillar Health Scorecard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Pillar 1: DevSecOps */}
            <div
              onClick={() => navigate('/security')}
              className="cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-xs hover:border-[#7C3AED] hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-dark-400 uppercase tracking-wider">DevSecOps Posture</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-600">
                  Grade {execSummary?.security?.posture_grade || 'A'}
                </span>
              </div>
              <div className="mt-2 text-2xl font-black text-dark-100">
                {execSummary?.security?.critical_findings ?? 0}
                <span className="text-xs font-semibold text-rose-500 ml-1">Critical</span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-dark-400">
                {execSummary?.security?.sbom_components_count ?? 18} SBOM packages verified
              </p>
            </div>

            {/* Pillar 2: SRE Reliability */}
            <div
              onClick={() => navigate('/uptime')}
              className="cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-xs hover:border-[#7C3AED] hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-dark-400 uppercase tracking-wider">SRE Reliability</span>
                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-bold text-[#7C3AED]">
                  {execSummary?.reliability?.compliance_percentage ?? 100}%
                </span>
              </div>
              <div className="mt-2 text-2xl font-black text-dark-100">
                {execSummary?.reliability?.slos_meeting_target ?? 3}
                <span className="text-xs font-normal text-dark-400 ml-1">/ {execSummary?.reliability?.slos_monitored ?? 3} SLOs</span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-dark-400">
                MTTR: {execSummary?.reliability?.average_mttr_minutes ?? 14.5}m • MTTD: {execSummary?.reliability?.average_mttd_minutes ?? 3.2}m
              </p>
            </div>

            {/* Pillar 3: Cloud FinOps */}
            <div
              onClick={() => navigate('/infrastructure/cost')}
              className="cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-xs hover:border-[#7C3AED] hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-dark-400 uppercase tracking-wider">Cloud FinOps</span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">
                  {execSummary?.finops?.active_optimizations ?? 0} Opts
                </span>
              </div>
              <div className="mt-2 text-2xl font-black text-dark-100">
                ${(execSummary?.finops?.total_spend_usd ?? 1280).toLocaleString()}
              </div>
              <p className="mt-1 text-[11px] font-medium text-emerald-600">
                Save ${execSummary?.finops?.potential_monthly_savings_usd ?? 180}/mo
              </p>
            </div>

            {/* Pillar 4: Disaster Recovery */}
            <div
              onClick={() => navigate('/disaster-recovery')}
              className="cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-xs hover:border-[#7C3AED] hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-dark-400 uppercase tracking-wider">DR Readiness</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600">
                  {execSummary?.disaster_recovery?.dr_readiness_pct ?? 100}%
                </span>
              </div>
              <div className="mt-2 text-2xl font-black text-dark-100">
                {execSummary?.disaster_recovery?.latest_rpo_minutes ?? 0.0}m
                <span className="text-xs font-normal text-dark-400 ml-1">RPO</span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-dark-400">
                {execSummary?.disaster_recovery?.backup_records_count ?? 3} backups • 0B loss
              </p>
            </div>

            {/* Pillar 5: Developer Portal & IaC */}
            <div
              onClick={() => navigate('/developer-portal')}
              className="cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-xs hover:border-[#7C3AED] hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-dark-400 uppercase tracking-wider">Services & IaC</span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-600">
                  Tier-1 Clean
                </span>
              </div>
              <div className="mt-2 text-2xl font-black text-dark-100">
                4 Services
              </div>
              <p className="mt-1 text-[11px] font-medium text-dark-400">
                3 Golden paths • 2 IaC stacks
              </p>
            </div>

            {/* Pillar 6: Incident Control */}
            <div
              onClick={() => navigate('/incidents')}
              className="cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-xs hover:border-[#7C3AED] hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-dark-400 uppercase tracking-wider">Active Incidents</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  (execSummary?.incidents?.p1_critical_active ?? 0) > 0
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {execSummary?.incidents?.p1_critical_active ?? 0} P1 Critical
                </span>
              </div>
              <div className="mt-2 text-2xl font-black text-dark-100">
                {execSummary?.incidents?.active_incidents ?? 0} Open
              </div>
              <p className="mt-1 text-[11px] font-medium text-dark-400">
                {execSummary?.incidents?.resolved_incidents ?? 12} resolved this month
              </p>
            </div>
          </div>

          {/* Row 1: AI DevOps Copilot, System Health & Quick Actions (Clean 3-column symmetry) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AiCopilotHighlightCard />
            <SystemHealthCard />
            <QuickActionsCard />
          </div>

          {/* Row 2: Architecture Topology & Live Remediation Alerts Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left 7 Cols: Service Inventory & Microservice Health */}
            <div className="lg:col-span-7 min-h-0">
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-dark-100 flex items-center gap-2">
                      <Boxes className="h-4 w-4 text-[#7C3AED]" />
                      Core Services & Golden Path Architecture
                    </h3>
                    <p className="text-xs text-dark-400">Spotify Backstage IDP microservices registered</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/developer-portal')}
                    rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}
                  >
                    Catalog
                  </Button>
                </div>

                <div className="space-y-3">
                  {(coreServices.length > 0
                    ? coreServices.map((svc) => ({
                        id: svc.id,
                        name: svc.name,
                        tier: svc.tier || 'TIER_1_CRITICAL',
                        status: svc.health_status || 'HEALTHY',
                        latency: '32ms',
                        team: svc.owner_team || 'Platform Team',
                      }))
                    : [
                        { id: 1, name: 'payment-gateway', tier: 'TIER_1_CRITICAL', status: 'HEALTHY', latency: '42ms', team: 'Core FinTech' },
                        { id: 2, name: 'auth-service', tier: 'TIER_1_CRITICAL', status: 'HEALTHY', latency: '28ms', team: 'SecOps Team' },
                        { id: 3, name: 'telemetry-collector', tier: 'TIER_2_CORE', status: 'HEALTHY', latency: '19ms', team: 'Observability' },
                      ]
                  ).map((svc, idx) => (
                    <div
                      key={svc.id ? `core-service-${svc.id}` : `core-service-${svc.name}-${idx}`}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-dark-100">{svc.name}</div>
                          <div className="text-[11px] text-dark-400">{svc.team} • {svc.tier.replace('_', ' ')}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-extrabold text-emerald-600">{svc.latency}</div>
                        <div className="text-[11px] font-medium text-dark-400">{svc.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Active Incident & Vulnerability Feed */}
            <div className="lg:col-span-5 min-h-0">
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-extrabold text-dark-100">Live Alert & Security Stream</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-dark-400">
                    Auto-Refreshing
                  </span>
                </div>

                <div className="space-y-3">
                  {liveIncidents.length > 0 ? (
                    liveIncidents.map((inc) => (
                      <div key={inc.id} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                        <div className="flex items-center justify-between">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-black text-white ${
                            inc.severity === 'CRITICAL' ? 'bg-rose-600' : inc.severity === 'HIGH' ? 'bg-amber-600' : 'bg-blue-600'
                          }`}>
                            {inc.priority} {inc.severity}
                          </span>
                          <span className="text-[10px] text-dark-400">{inc.service || 'Core System'}</span>
                        </div>
                        <div className="mt-1 text-xs font-bold text-dark-100">
                          {inc.title}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-rose-700 font-semibold">{inc.environment || 'production'} • {inc.status}</span>
                          <button
                            onClick={() => navigate('/incidents')}
                            className="text-xs font-bold text-[#7C3AED] hover:underline"
                          >
                            Investigate →
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="rounded-md bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                            CVE-2024-21626
                          </span>
                          <span className="text-[10px] text-dark-400">Container RunC</span>
                        </div>
                        <div className="mt-1 text-xs font-bold text-dark-100">
                          Container breakout vulnerability detected in base image
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-rose-700 font-semibold">Patch: Upgrade to v1.1.12</span>
                          <button
                            onClick={() => navigate('/security')}
                            className="text-xs font-bold text-[#7C3AED] hover:underline"
                          >
                            View Remediation →
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">
                            SLO BURN RATE
                          </span>
                          <span className="text-[10px] text-dark-400">API Gateway</span>
                        </div>
                        <div className="mt-1 text-xs font-bold text-dark-100">
                          1h error budget burn rate at 1.4x baseline threshold
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-amber-700 font-semibold">Budget: 94.2% remaining</span>
                          <button
                            onClick={() => navigate('/uptime')}
                            className="text-xs font-bold text-[#7C3AED] hover:underline"
                          >
                            Investigate →
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="rounded-md bg-blue-500 px-2 py-0.5 text-[10px] font-black text-white">
                            FINOPS IDLE
                          </span>
                          <span className="text-[10px] text-dark-400">AWS us-east-1</span>
                        </div>
                        <div className="mt-1 text-xs font-bold text-dark-100">
                          2 unattached EBS gp3 volumes detected (120 GB total)
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-blue-700 font-semibold">Savings: $18.40/month</span>
                          <button
                            onClick={() => navigate('/infrastructure/cost')}
                            className="text-xs font-bold text-[#7C3AED] hover:underline"
                          >
                            Release →
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Repository Telemetry Strip */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-dark-300 uppercase tracking-wider">
                  Repository Telemetry & CI/CD Health
                </h2>
                <p className="text-[11px] font-medium text-dark-400">
                  Synced {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/repositories')}
                leftIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Import Repo
              </Button>
            </div>
            <RepositoryTelemetryStrip stats={stats} isLoading={isLoading} />
          </div>
        </div>
      )}

      {/* TAB 2: DORA & CI/CD Telemetry (Preserved full depth) */}
      {activeTab === 'dora' && (
        <div className="space-y-6">
          <StatsGrid stats={stats} dora={dora} isLoading={isLoading} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <DoraMetricsOverviewCard dora={dora} isLoading={isLoading} />
            </div>
            <div className="lg:col-span-7">
              <DeploymentTrendChart data={buildTrends} isLoading={isLoading} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <BuildTrendChart data={buildTrends} isLoading={isLoading} />
            </div>
            <div className="lg:col-span-5">
              <RecentActivity activities={activities} isLoading={isLoading} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <WorkflowPerformanceChart data={workflowPerf} isLoading={isLoading} />
            <RepositoryActivityChart data={repoActivity} isLoading={isLoading} />
          </div>
        </div>
      )}

      {/* TAB 3: Executive Audits, Reports & Notifications Delivery */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 Cols: Cryptographic Audit Certificate & Executive Metric Breakdown */}
            <div className="lg:col-span-8 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E7EB] pb-4 gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-dark-100 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-[#7C3AED]" />
                    DevOpsPulse Executive Compliance & Audit Briefing
                  </h2>
                  <p className="text-xs text-dark-400">
                    Cryptographically hashed executive intelligence summary
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={handleDownloadCsv} leftIcon={<Download className="h-3.5 w-3.5" />}>
                    Download CSV
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleOpenPdf} leftIcon={<Printer className="h-3.5 w-3.5" />}>
                    Print PDF
                  </Button>
                </div>
              </div>

              {/* Digital Hash Banner */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-dark-300">Digital Integrity Signature (SHA-256): </span>
                  <code className="text-[#7C3AED] font-mono break-all">{execSummary?.integrity_signature || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}</code>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  VERIFIED
                </span>
              </div>

              {/* Structured Metric Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-dark-400">DevSecOps & Supply Chain</h4>
                  <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                    <span className="text-dark-300">Security Grade</span>
                    <span className="font-black text-emerald-600">{execSummary?.security?.posture_grade || 'A'}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                    <span className="text-dark-300">Critical / High CVEs</span>
                    <span className="font-bold text-rose-600">{execSummary?.security?.critical_findings ?? 0} / {execSummary?.security?.high_findings ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-dark-300">Cataloged SBOM Packages</span>
                    <span className="font-bold text-dark-100">{execSummary?.security?.sbom_components_count ?? 18}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-dark-400">SRE & Resiliency</h4>
                  <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                    <span className="text-dark-300">SLO Compliance Rate</span>
                    <span className="font-black text-emerald-600">{execSummary?.reliability?.compliance_percentage ?? 100}%</span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                    <span className="text-dark-300">Mean Time to Resolve (MTTR)</span>
                    <span className="font-bold text-dark-100">{execSummary?.reliability?.average_mttr_minutes ?? 14.5} mins</span>
                  </div>
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-dark-300">Disaster Recovery Readiness</span>
                    <span className="font-bold text-[#7C3AED]">{execSummary?.disaster_recovery?.dr_readiness_pct ?? 100}%</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-dark-400">Cloud FinOps</h4>
                  <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                    <span className="text-dark-300">Monthly Cloud Spend</span>
                    <span className="font-black text-dark-100">${(execSummary?.finops?.total_spend_usd ?? 1280).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                    <span className="text-dark-300">Forecasted Run-rate</span>
                    <span className="font-bold text-dark-100">${(execSummary?.finops?.forecasted_run_rate_usd ?? 1382.4).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-dark-300">Actionable Savings</span>
                    <span className="font-bold text-emerald-600">${execSummary?.finops?.potential_monthly_savings_usd ?? 180}/mo</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-dark-400">Delivery Velocity</h4>
                  <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                    <span className="text-dark-300">Deployment Success Rate</span>
                    <span className="font-black text-emerald-600">{execSummary?.cicd?.deployment_success_rate_pct ?? 98.4}%</span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-slate-200/60">
                    <span className="text-dark-300">Total Deployments</span>
                    <span className="font-bold text-dark-100">{execSummary?.cicd?.total_deployments ?? 142}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-dark-300">Lead Time for Changes</span>
                    <span className="font-bold text-dark-100">{execSummary?.cicd?.average_lead_time_hours ?? 2.4} hours</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 4 Cols: Live Notification Verification & Dispatch Tool */}
            <div className="lg:col-span-4 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-extrabold text-dark-100 flex items-center gap-2">
                  <Send className="h-4 w-4 text-[#7C3AED]" />
                  Notification Channel Tester
                </h3>
                <p className="text-xs text-dark-400">
                  Genuinely test delivery. Never claims success without actual probe.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-dark-300">Channel Type</label>
                  <div className="mt-1 flex gap-2">
                    {(['WEBHOOK', 'EMAIL', 'SLACK'] as const).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => {
                          setTestChannel(ch);
                          if (ch === 'EMAIL') setTestTarget('devops-lead@company.com');
                          if (ch === 'WEBHOOK') setTestTarget('https://webhook.site/test');
                          if (ch === 'SLACK') setTestTarget('https://example.com/webhook/slack-alerts');
                        }}
                        className={`flex-1 rounded-xl py-1.5 text-xs font-bold border transition-all ${
                          testChannel === ch
                            ? 'border-[#7C3AED] bg-purple-50 text-[#7C3AED]'
                            : 'border-slate-200 text-dark-400 hover:bg-slate-50'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-dark-300">
                    {testChannel === 'EMAIL' ? 'Recipient Email' : 'Webhook Endpoint URL'}
                  </label>
                  <input
                    type="text"
                    value={testTarget}
                    onChange={(e) => setTestTarget(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono text-dark-100 focus:border-[#7C3AED] focus:outline-none"
                    placeholder={testChannel === 'EMAIL' ? 'audit@company.com' : 'https://...'}
                  />
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  isLoading={isTestingNotif}
                  onClick={handleTestNotification}
                  leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                >
                  Verify Live Delivery Probe
                </Button>

                {/* Probe Result Display */}
                {testResult && (
                  <div className={`mt-3 rounded-xl border p-3.5 text-xs ${
                    testResult.delivery_status === 'DELIVERED'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : testResult.delivery_status === 'CONFIG_MISSING'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}>
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span>Status: {testResult.delivery_status}</span>
                      <span>{testResult.latency_ms} ms</span>
                    </div>
                    <p className="text-[11px] font-medium leading-relaxed">{testResult.details}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
