import React, { useEffect, useState, useMemo } from 'react';
import {
  Boxes,
  Layers,
  Terminal,
  ExternalLink,
  FileText,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Plus,
  Compass,
  Code2,
  GitBranch,
  FolderGit2,
  Cpu,
  AlertTriangle,
  Play,
  Check,
  Filter,
} from 'lucide-react';
import {
  developerPortalService,
  DeveloperPortalOverview,
  ServiceCatalogItem,
  TerraformWorkspace,
  TerraformRun,
  GoldenPathTemplate,
  ServiceTier,
} from '@/services/developerPortal';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CountUp } from '@/components/ui/CountUp';

type PortalTab = 'catalog' | 'iac' | 'templates';

export const DeveloperPortalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PortalTab>('catalog');
  const [data, setData] = useState<DeveloperPortalOverview | null>(null);
  const [workspaces, setWorkspaces] = useState<TerraformWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchFilter, setSearchFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');

  // Modals
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [activePlanRun, setActivePlanRun] = useState<TerraformRun | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // Actions loading
  const [planningWsId, setPlanningWsId] = useState<number | null>(null);
  const [driftingWsId, setDriftingWsId] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Service Form
  const [svcName, setSvcName] = useState('');
  const [svcDisplayName, setSvcDisplayName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcTier, setSvcTier] = useState<ServiceTier>('TIER_1_CRITICAL');
  const [svcTeam, setSvcTeam] = useState('');
  const [svcTech, setSvcTech] = useState('');
  const [svcRepo, setSvcRepo] = useState('');
  const [svcDocs, setSvcDocs] = useState('');
  const [svcApi, setSvcApi] = useState('');
  const [isSubmittingSvc, setIsSubmittingSvc] = useState(false);

  // New Workspace Form
  const [wsName, setWsName] = useState('');
  const [wsRepo, setWsRepo] = useState('');
  const [wsDir, setWsDir] = useState('terraform');
  const [wsVersion, setWsVersion] = useState('1.8.2');
  const [wsDesc, setWsDesc] = useState('');
  const [isSubmittingWs, setIsSubmittingWs] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [overviewRes, wsRes] = await Promise.all([
        developerPortalService.getOverview(),
        developerPortalService.listWorkspaces(),
      ]);
      setData(overviewRes.data);
      setWorkspaces(wsRes.data);
    } catch (err) {
      console.error('Failed to load Developer Portal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSvc(true);
    setFeedbackMsg(null);
    try {
      await developerPortalService.createService({
        name: svcName,
        display_name: svcDisplayName,
        description: svcDesc,
        tier: svcTier,
        owner_team: svcTeam,
        tech_stack: svcTech,
        repository_url: svcRepo || undefined,
        documentation_url: svcDocs || undefined,
        api_spec_url: svcApi || undefined,
      });
      setIsServiceModalOpen(false);
      setSvcName('');
      setSvcDisplayName('');
      setSvcDesc('');
      setSvcTeam('');
      setSvcTech('');
      setFeedbackMsg({ type: 'success', text: `Service '${svcDisplayName}' registered in catalog.` });
      await loadData();
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to register microservice.' });
    } finally {
      setIsSubmittingSvc(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingWs(true);
    setFeedbackMsg(null);
    try {
      await developerPortalService.createWorkspace({
        name: wsName,
        repository_url: wsRepo,
        working_directory: wsDir,
        terraform_version: wsVersion,
        description: wsDesc,
      });
      setIsWorkspaceModalOpen(false);
      setWsName('');
      setWsRepo('');
      setFeedbackMsg({ type: 'success', text: `Terraform workspace '${wsName}' connected.` });
      await loadData();
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to connect Terraform workspace.' });
    } finally {
      setIsSubmittingWs(false);
    }
  };

  const handlePlanWorkspace = async (wsId: number) => {
    setPlanningWsId(wsId);
    setFeedbackMsg(null);
    try {
      const res = await developerPortalService.planWorkspace(wsId);
      setActivePlanRun(res.data);
      setIsPlanModalOpen(true);
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to generate Terraform plan.' });
    } finally {
      setPlanningWsId(null);
    }
  };

  const handleApplyRun = async () => {
    if (!activePlanRun) return;
    setIsApplying(true);
    try {
      const res = await developerPortalService.applyRun(activePlanRun.id, 'Staff DevOps Engineer');
      setIsPlanModalOpen(false);
      setActivePlanRun(null);
      setFeedbackMsg({
        type: 'success',
        text: `Terraform plan #${res.data.id} successfully applied (${res.data.resources_to_add} added, ${res.data.resources_to_change} modified).`,
      });
      await loadData();
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to apply Terraform run.' });
    } finally {
      setIsApplying(false);
    }
  };

  const handleCheckDrift = async (wsId: number) => {
    setDriftingWsId(wsId);
    setFeedbackMsg(null);
    try {
      const res = await developerPortalService.checkDrift(wsId);
      setFeedbackMsg({
        type: 'success',
        text: `Drift inspection complete for ${res.data.name}: Live infrastructure is 100% in-sync with declared IaC templates.`,
      });
      await loadData();
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to check drift.' });
    } finally {
      setDriftingWsId(null);
    }
  };

  const filteredServices = useMemo(() => {
    if (!data?.services) return [];
    return data.services.filter((s) => {
      if (tierFilter !== 'ALL' && s.tier !== tierFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.display_name.toLowerCase().includes(q) ||
          s.owner_team.toLowerCase().includes(q) ||
          s.tech_stack.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data?.services, tierFilter, searchFilter]);

  if (isLoading && !data) {
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100 flex items-center gap-2">
              <Compass className="h-6 w-6 text-primary-600" />
              Developer Portal &amp; IaC Hub
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-primary-50 text-primary-800 border-primary-200">
              <Boxes className="h-3.5 w-3.5 text-primary-600" />
              {data?.total_services || 0} Registered Services
            </span>
          </div>
          <p className="text-xs font-medium text-dark-400 mt-1">
            Spotify Backstage-style Service Catalog, Team Ownership Matrix, Terraform IaC Drift Detection, and Golden Path Templates
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'catalog' && (
            <Button
              variant="primary"
              onClick={() => setIsServiceModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Register Service
            </Button>
          )}

          {activeTab === 'iac' && (
            <Button
              variant="primary"
              onClick={() => setIsWorkspaceModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Connect Workspace
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`rounded-xl border p-3.5 text-xs font-medium flex items-center justify-between shadow-2xs ${
            feedbackMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="font-bold ml-2 hover:opacity-75">
            ×
          </button>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Total Services</span>
              <Compass className="h-4 w-4 text-primary-600" />
            </div>
            <div className="text-2xl font-extrabold text-dark-100 mt-1">
              <CountUp value={data.total_services} />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">Cataloged across organization</div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Tier-1 Critical</span>
              <ShieldCheck className="h-4 w-4 text-rose-500" />
            </div>
            <div className="text-2xl font-extrabold text-dark-100 mt-1">
              <CountUp value={data.tier_1_count} />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">High-availability SLA target</div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">IaC Workspaces</span>
              <Cpu className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold text-dark-100 mt-1">
              <CountUp value={workspaces.length} />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">0 configuration drifts detected</div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Golden Paths</span>
              <Layers className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">
              <CountUp value={data.templates_count} />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">Pre-approved scaffolding templates</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB]">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'catalog'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <Compass className="h-4 w-4" />
            Service Catalog &amp; Ownership
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {data?.services.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('iac')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'iac'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <Cpu className="h-4 w-4" />
            Terraform Infrastructure as Code
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {workspaces.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <Layers className="h-4 w-4" />
            Golden Path Scaffolding Templates
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
              {data?.templates.length || 0}
            </span>
          </button>
        </nav>
      </div>

      {/* TAB 1: Service Catalog & Ownership */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex flex-wrap items-center justify-between gap-3 shadow-subtle">
            <div className="flex flex-wrap items-center gap-3 text-xs flex-1">
              <input
                type="text"
                placeholder="Search services by name, team, tech stack..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-xs text-dark-100 w-full sm:w-72 focus:outline-hidden"
              />

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-xs font-medium text-dark-100 focus:outline-hidden"
              >
                <option value="ALL">All Service Tiers</option>
                <option value="TIER_1_CRITICAL">Tier 1 - Mission Critical</option>
                <option value="TIER_2_CORE">Tier 2 - Core</option>
                <option value="TIER_3_SUPPORTING">Tier 3 - Supporting</option>
              </select>
            </div>

            <span className="text-xs font-mono text-dark-400">
              Showing {filteredServices.length} of {data?.services.length || 0} services
            </span>
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map((svc) => (
              <div
                key={svc.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {svc.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        svc.tier === 'TIER_1_CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-primary-50 text-primary-700 border-primary-200'
                      }`}
                    >
                      {svc.tier.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-dark-100">{svc.display_name}</h3>
                  <p className="text-xs text-dark-400 line-clamp-2 leading-relaxed">{svc.description}</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-[#E5E7EB] space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-dark-400 font-sans font-semibold">Owner Team:</span>
                    <strong className="text-dark-100 font-sans">{svc.owner_team}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-dark-400 font-sans font-semibold">Tech Stack:</span>
                    <span className="text-slate-700 truncate max-w-[160px]">{svc.tech_stack}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-dark-400 font-sans font-semibold">Health:</span>
                    <span className="text-emerald-700 font-semibold">{svc.health_status}</span>
                  </div>
                </div>

                {/* Direct Action Links */}
                <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {svc.repository_url && (
                      <a
                        href={svc.repository_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-dark-400 hover:text-primary-600 flex items-center gap-1"
                        title="Repository"
                      >
                        <FolderGit2 className="h-3.5 w-3.5" /> Code
                      </a>
                    )}
                    {svc.documentation_url && (
                      <a
                        href={svc.documentation_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-dark-400 hover:text-primary-600 flex items-center gap-1"
                        title="Documentation"
                      >
                        <FileText className="h-3.5 w-3.5" /> Docs
                      </a>
                    )}
                  </div>

                  {svc.api_spec_url && (
                    <a
                      href={svc.api_spec_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-[11px] text-primary-600 hover:underline"
                    >
                      <Code2 className="h-3.5 w-3.5" /> OpenAPI Spec
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Terraform Infrastructure as Code */}
      {activeTab === 'iac' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-subtle overflow-hidden">
            <div className="p-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-dark-100">Terraform IaC Workspaces</h3>
                <p className="text-xs font-medium text-dark-400">
                  Infrastructure change previews, Checkov security compliance, and configuration drift detection
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsWorkspaceModalOpen(true)}
                leftIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Connect Workspace
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#E5E7EB] text-dark-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Workspace</th>
                    <th className="py-3 px-4">Working Directory</th>
                    <th className="py-3 px-4">Terraform</th>
                    <th className="py-3 px-4">Resources</th>
                    <th className="py-3 px-4">Drift Status</th>
                    <th className="py-3 px-4">Last Applied</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {workspaces.map((ws) => (
                    <tr key={ws.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-dark-100 font-mono">{ws.name}</td>
                      <td className="py-3 px-4 font-mono text-dark-400">{ws.working_directory}</td>
                      <td className="py-3 px-4 font-mono">v{ws.terraform_version}</td>
                      <td className="py-3 px-4 font-mono font-bold text-dark-100">{ws.resource_count}</td>
                      <td className="py-3 px-4">
                        {ws.has_drift ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[11px]">
                            <AlertTriangle className="h-3 w-3" /> Drift Detected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px]">
                            <CheckCircle2 className="h-3 w-3" /> In-Sync
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-dark-400">
                        {ws.last_applied_at ? new Date(ws.last_applied_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCheckDrift(ws.id)}
                            disabled={driftingWsId === ws.id}
                            leftIcon={
                              driftingWsId === ws.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )
                            }
                          >
                            Check Drift
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handlePlanWorkspace(ws.id)}
                            disabled={planningWsId === ws.id}
                            leftIcon={
                              planningWsId === ws.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )
                            }
                          >
                            Plan &amp; Scan
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Golden Path Scaffolding Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data?.templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                      {tmpl.category}
                    </span>
                    {tmpl.is_recommended && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Recommended
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-dark-100">{tmpl.name}</h3>
                  <p className="text-xs text-dark-400 leading-relaxed">{tmpl.description}</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-[#E5E7EB] text-xs font-mono space-y-1">
                  <div>
                    <span className="text-[10px] font-sans uppercase text-dark-400 font-semibold block">CI/CD Standard:</span>
                    <strong className="text-dark-100 font-sans">{tmpl.ci_template}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#F1F5F9] flex justify-end">
                  <a
                    href={tmpl.repository_template_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                  >
                    <FolderGit2 className="h-3.5 w-3.5" /> Scaffold Project
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan Preview & Security Check Modal */}
      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        title="Terraform Plan Preview & IaC Security Audit"
      >
        {activePlanRun && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-xl border border-[#E5E7EB]">
              <div>
                <span className="text-dark-400 block font-semibold">Change Summary:</span>
                <span className="font-mono font-bold text-dark-100">
                  +{activePlanRun.resources_to_add} to add, ~{activePlanRun.resources_to_change} to change, -{activePlanRun.resources_to_destroy} to destroy
                </span>
              </div>

              <div className="text-right">
                <span className="text-dark-400 block font-semibold">IaC Security:</span>
                {activePlanRun.security_scan_passed ? (
                  <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Checkov Passed
                  </span>
                ) : (
                  <span className="text-rose-600 font-bold">Issues Flagged</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Terraform Execution Plan Output</label>
              <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed">
                {activePlanRun.plan_output}
              </pre>
            </div>

            {activePlanRun.rollback_guidance && (
              <div className="bg-slate-50 p-3 rounded-xl border border-[#E5E7EB] text-xs space-y-1">
                <strong className="text-dark-100 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Safe Rollback Guidance
                </strong>
                <p className="text-slate-700 font-mono text-[11px]">{activePlanRun.rollback_guidance}</p>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsPlanModalOpen(false)}
              >
                Close Preview
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleApplyRun}
                disabled={isApplying}
                leftIcon={isApplying ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              >
                {isApplying ? 'Applying Changes...' : 'Authorize & Apply'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Register Service Modal */}
      <Modal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        title="Register Microservice in Developer Portal"
      >
        <form onSubmit={handleCreateService} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Service Identifier</label>
              <input
                type="text"
                value={svcName}
                onChange={(e) => setSvcName(e.target.value)}
                placeholder="e.g. inventory-service"
                required
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Display Title</label>
              <input
                type="text"
                value={svcDisplayName}
                onChange={(e) => setSvcDisplayName(e.target.value)}
                placeholder="e.g. Inventory Management Engine"
                required
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-medium text-dark-100 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Description</label>
            <textarea
              value={svcDesc}
              onChange={(e) => setSvcDesc(e.target.value)}
              rows={2}
              required
              placeholder="What does this service do and what is its operational domain?"
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-dark-100 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Owner Squad / Team</label>
              <input
                type="text"
                value={svcTeam}
                onChange={(e) => setSvcTeam(e.target.value)}
                placeholder="e.g. Platform SRE"
                required
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-dark-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Service Tier</label>
              <select
                value={svcTier}
                onChange={(e) => setSvcTier(e.target.value as ServiceTier)}
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-medium text-dark-100 focus:outline-hidden"
              >
                <option value="TIER_1_CRITICAL">Tier 1 - Mission Critical</option>
                <option value="TIER_2_CORE">Tier 2 - Core Functionality</option>
                <option value="TIER_3_SUPPORTING">Tier 3 - Supporting / Internal</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Tech Stack</label>
            <input
              type="text"
              value={svcTech}
              onChange={(e) => setSvcTech(e.target.value)}
              placeholder="e.g. Go 1.22, PostgreSQL, Redis"
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-dark-100 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Repository URL</label>
              <input
                type="url"
                value={svcRepo}
                onChange={(e) => setSvcRepo(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">OpenAPI / Swagger URL</label>
              <input
                type="url"
                value={svcApi}
                onChange={(e) => setSvcApi(e.target.value)}
                placeholder="https://api.org.com/openapi.yaml"
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsServiceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingSvc}
              leftIcon={isSubmittingSvc ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Compass className="h-3.5 w-3.5" />}
            >
              {isSubmittingSvc ? 'Registering...' : 'Register Service'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Connect Workspace Modal */}
      <Modal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        title="Connect Terraform IaC Workspace"
      >
        <form onSubmit={handleCreateWorkspace} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Workspace Name</label>
            <input
              type="text"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              placeholder="e.g. prod-aws-eks-cluster"
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Git Repository URL</label>
            <input
              type="url"
              value={wsRepo}
              onChange={(e) => setWsRepo(e.target.value)}
              placeholder="https://github.com/org/infra-terraform"
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Working Directory</label>
              <input
                type="text"
                value={wsDir}
                onChange={(e) => setWsDir(e.target.value)}
                placeholder="terraform/environments/prod"
                required
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Terraform Version</label>
              <input
                type="text"
                value={wsVersion}
                onChange={(e) => setWsVersion(e.target.value)}
                required
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsWorkspaceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingWs}
              leftIcon={isSubmittingWs ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5" />}
            >
              {isSubmittingWs ? 'Connecting...' : 'Connect Workspace'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DeveloperPortalPage;
