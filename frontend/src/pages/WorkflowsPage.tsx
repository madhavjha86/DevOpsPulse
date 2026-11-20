import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Play,
  Server,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import { workflowService } from '@/services/workflows';
import { repositoryService } from '@/services/repositories';
import {
  jenkinsService,
  type JenkinsServer,
  type JenkinsJob,
  type JenkinsBuild,
} from '@/services/jenkins';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { WorkflowRun, Repository } from '@/types';

export const WorkflowsPage: React.FC = () => {
  // Active tab: 'github' | 'jenkins'
  const [activeProvider, setActiveProvider] = useState<'github' | 'jenkins'>('github');

  // GitHub Actions state
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [filterConclusion, setFilterConclusion] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAutoPolling, setIsAutoPolling] = useState<boolean>(false);

  // Dispatch modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<number | ''>('');
  const [workflowName, setWorkflowName] = useState('CI / Tests & Lint');
  const [branch, setBranch] = useState('main');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  // Jenkins CI/CD state
  const [jenkinsServers, setJenkinsServers] = useState<JenkinsServer[]>([]);
  const [isJenkinsLoading, setIsJenkinsLoading] = useState<boolean>(false);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);
  const [jenkinsBanner, setJenkinsBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Jenkins Server Connect Modal
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [serverName, setServerName] = useState('Production Jenkins Controller');
  const [serverUrl, setServerUrl] = useState('http://localhost:8080');
  const [serverUser, setServerUser] = useState('admin');
  const [serverToken, setServerToken] = useState('');
  const [isSavingServer, setIsSavingServer] = useState(false);

  // Jenkins Logs Modal
  const [logsModal, setLogsModal] = useState<{
    isOpen: boolean;
    jobName: string;
    buildNumber: number;
    logs: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    jobName: '',
    buildNumber: 0,
    logs: '',
    isLoading: false,
  });
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Check if any workflow is currently running or queued
  const hasActiveRuns = runs.some(
    (r) =>
      r.status === 'in_progress' ||
      r.status === 'queued' ||
      (!r.conclusion && r.status !== 'completed')
  );

  const fetchWorkflows = async (pageNum: number = 1, conclusion: string = 'all') => {
    setIsLoading(true);
    try {
      const concParam = conclusion === 'all' ? undefined : conclusion;
      const { data } = await workflowService.getAll(pageNum, undefined, concParam);
      setRuns(data.workflow_runs || []);
      setTotal(data.total || 0);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load workflows', err);
    } finally {
      setIsLoading(false);
    }
  };

  const silentPollWorkflows = async () => {
    try {
      setIsAutoPolling(true);
      const concParam = filterConclusion === 'all' ? undefined : filterConclusion;
      const { data } = await workflowService.getAll(page, undefined, concParam);
      if (data?.workflow_runs) {
        setRuns(data.workflow_runs);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.warn('Silent workflows poll failed:', err);
    } finally {
      setIsAutoPolling(false);
    }
  };

  const fetchJenkins = async () => {
    setIsJenkinsLoading(true);
    try {
      const { data } = await jenkinsService.getServers();
      setJenkinsServers(data || []);
    } catch (err) {
      console.error('Failed to load Jenkins servers', err);
    } finally {
      setIsJenkinsLoading(false);
    }
  };

  useEffect(() => {
    void fetchWorkflows(1, filterConclusion);
    repositoryService
      .getAll(1, 100)
      .then((res: any) => {
        const repoList = res.data?.repositories || [];
        setRepos(repoList);
        if (repoList.length > 0) {
          setSelectedRepoId(repoList[0].id);
        }
      })
      .catch(() => {});
  }, [filterConclusion]);

  useEffect(() => {
    if (activeProvider === 'jenkins') {
      void fetchJenkins();
    }
  }, [activeProvider]);

  // Real-time polling for GitHub actions: 6s if active, 20s otherwise
  useEffect(() => {
    if (activeProvider !== 'github') return;
    const intervalMs = hasActiveRuns ? 6000 : 20000;
    const timer = setInterval(() => {
      void silentPollWorkflows();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [page, filterConclusion, hasActiveRuns, activeProvider]);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepoId) return;
    setIsDispatching(true);
    setDispatchSuccess(null);
    try {
      await workflowService.dispatch({
        repository_id: Number(selectedRepoId),
        workflow_name: workflowName,
        branch,
      });
      setIsModalOpen(false);
      setDispatchSuccess(`Workflow '${workflowName}' dispatched successfully on '${branch}' branch!`);
      void fetchWorkflows(1, filterConclusion);
    } catch (err) {
      console.error('Dispatch failed', err);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleTriggerJenkins = async (serverId: number, jobName: string) => {
    setTriggeringJob(jobName);
    setJenkinsBanner(null);
    try {
      const { data } = await jenkinsService.triggerBuild(serverId, jobName);
      setJenkinsBanner({
        type: 'success',
        message: `Pipeline '${jobName}' #${data.build_number} triggered successfully! Build is running.`,
      });
      // Refresh Jenkins jobs state
      await fetchJenkins();
    } catch (err: any) {
      console.error('Trigger Jenkins build failed', err);
      setJenkinsBanner({
        type: 'error',
        message: `Failed to trigger pipeline '${jobName}': ${err.response?.data?.detail || err.message}`,
      });
    } finally {
      setTriggeringJob(null);
    }
  };

  const handleViewJenkinsLogs = async (serverId: number, jobName: string, buildNumber: number) => {
    setLogsModal({
      isOpen: true,
      jobName,
      buildNumber,
      logs: '',
      isLoading: true,
    });
    try {
      const { data } = await jenkinsService.getBuildLogs(serverId, jobName, buildNumber);
      setLogsModal((prev) => ({
        ...prev,
        logs: data.logs || 'No logs recorded.',
        isLoading: false,
      }));
    } catch (err) {
      setLogsModal((prev) => ({
        ...prev,
        logs: 'Failed to retrieve console execution output from Jenkins controller.',
        isLoading: false,
      }));
    }
  };

  const handleConnectServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingServer(true);
    try {
      await jenkinsService.createServer({
        name: serverName,
        server_url: serverUrl,
        username: serverUser,
        api_token: serverToken || undefined,
      });
      setIsConnectModalOpen(false);
      setJenkinsBanner({
        type: 'success',
        message: `Jenkins Controller '${serverName}' connected successfully!`,
      });
      void fetchJenkins();
    } catch (err: any) {
      console.error('Failed to connect Jenkins controller', err);
      setJenkinsBanner({
        type: 'error',
        message: `Connection failed: ${err.response?.data?.detail || err.message}`,
      });
    } finally {
      setIsSavingServer(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const getStatusBadge = (run: WorkflowRun) => {
    const outcome = run.conclusion || run.status;
    if (outcome === 'success') {
      return (
        <Badge variant="success" dot className="bg-emerald-50 text-emerald-700 border-emerald-200">
          Success
        </Badge>
      );
    }
    if (outcome === 'failure') {
      return (
        <Badge variant="danger" dot className="bg-rose-50 text-rose-700 border-rose-200">
          Failed
        </Badge>
      );
    }
    if (outcome === 'in_progress') {
      return (
        <Badge variant="warning" className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border-amber-200 animate-pulse font-bold">
          <RefreshCw className="h-3 w-3 animate-spin text-amber-600" />
          Running
        </Badge>
      );
    }
    if (outcome === 'queued') {
      return (
        <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-200 font-medium">
          Queued
        </Badge>
      );
    }
    return <Badge variant="neutral">{outcome}</Badge>;
  };

  const getJenkinsBuildBadge = (status: string | null) => {
    const s = (status || '').toUpperCase();
    if (s === 'SUCCESS') {
      return (
        <Badge variant="success" dot className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
          SUCCESS
        </Badge>
      );
    }
    if (s === 'UNSTABLE') {
      return (
        <Badge variant="warning" dot className="bg-amber-50 text-amber-700 border-amber-200 font-semibold">
          UNSTABLE
        </Badge>
      );
    }
    if (s === 'FAILURE' || s === 'FAILED') {
      return (
        <Badge variant="danger" dot className="bg-rose-50 text-rose-700 border-rose-200 font-semibold">
          FAILURE
        </Badge>
      );
    }
    if (s === 'IN_PROGRESS' || s === 'RUNNING') {
      return (
        <Badge variant="warning" className="flex items-center gap-1.5 bg-sky-50 text-sky-700 border-sky-200 animate-pulse font-bold">
          <RefreshCw className="h-3 w-3 animate-spin text-sky-600" />
          IN PROGRESS
        </Badge>
      );
    }
    return <Badge variant="neutral">{status || 'UNKNOWN'}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100">CI/CD Automation</h1>
          <p className="text-xs font-medium text-dark-400 mt-0.5">
            Unified multi-engine pipeline management across GitHub Actions & Jenkins
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {activeProvider === 'github' && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-200/90 bg-emerald-50/90 text-emerald-800 text-xs font-semibold shadow-2xs">
                <span className="relative flex h-2 w-2">
                  {hasActiveRuns ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                  )}
                </span>
                <span>{hasActiveRuns ? 'Live Auto-Sync (6s)' : 'Live Telemetry Active'}</span>
                {isAutoPolling && (
                  <RefreshCw className="h-3 w-3 animate-spin text-emerald-700 ml-1" />
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchWorkflows(page, filterConclusion)}
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                leftIcon={<Play className="h-3.5 w-3.5" />}
              >
                Dispatch Pipeline
              </Button>
            </>
          )}

          {activeProvider === 'jenkins' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchJenkins}
                leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isJenkinsLoading ? 'animate-spin' : ''}`} />}
              >
                Sync Jenkins
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsConnectModalOpen(true)}
                leftIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Connect Controller
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Provider Selector Tabs */}
      <div className="flex items-center gap-3 border-b border-[#E5E7EB] pb-3">
        <button
          onClick={() => setActiveProvider('github')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeProvider === 'github'
              ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
              : 'bg-white border border-[#E5E7EB] text-dark-300 hover:text-dark-100 hover:bg-slate-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          GitHub Actions ({total})
        </button>
        <button
          onClick={() => setActiveProvider('jenkins')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeProvider === 'jenkins'
              ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
              : 'bg-white border border-[#E5E7EB] text-dark-300 hover:text-dark-100 hover:bg-slate-50'
          }`}
        >
          <Server className="w-3.5 h-3.5 text-amber-500" />
          Jenkins CI/CD ({jenkinsServers.reduce((acc, s) => acc + (s.jobs_count || 0), 0)} Jobs)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* GITHUB ACTIONS TAB */}
      {/* ========================================================================= */}
      {activeProvider === 'github' && (
        <div className="space-y-4">
          {dispatchSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium flex items-center justify-between shadow-2xs">
              <span>{dispatchSuccess}</span>
              <button onClick={() => setDispatchSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">
                ×
              </button>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { key: 'all', label: 'All Runs' },
              { key: 'success', label: 'Successful' },
              { key: 'failure', label: 'Failed' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterConclusion(tab.key)}
                className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  filterConclusion === tab.key
                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
                    : 'bg-white border border-[#E5E7EB] text-dark-400 hover:text-dark-100 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Workflows Table */}
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner size="lg" message="Loading workflow runs..." />
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-subtle overflow-hidden">
              <Table<WorkflowRun>
                columns={[
                  {
                    header: 'Workflow / Run',
                    key: 'workflow_name',
                    render: (r) => (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-dark-100">{r.workflow_name}</span>
                          <span className="font-mono text-xs text-dark-400">#{r.run_number}</span>
                        </div>
                        <span className="text-[10px] text-dark-400 uppercase tracking-wider font-mono font-medium">
                          Event: {r.event || 'push'}
                        </span>
                      </div>
                    ),
                  },
                  {
                    header: 'Outcome',
                    key: 'conclusion',
                    render: (r) => getStatusBadge(r),
                  },
                  {
                    header: 'Branch',
                    key: 'branch',
                    render: (r) => (
                      <span className="font-mono text-xs font-medium text-dark-300">{r.branch || 'main'}</span>
                    ),
                  },
                  {
                    header: 'Duration',
                    key: 'duration_seconds',
                    render: (r) => (
                      <span className="text-xs font-medium text-dark-300">
                        {r.duration_seconds !== null && r.duration_seconds !== undefined
                          ? `${r.duration_seconds}s`
                          : '—'}
                      </span>
                    ),
                  },
                  {
                    header: 'Triggered',
                    key: 'created_at',
                    render: (r) => (
                      <span className="text-xs text-dark-400 font-medium">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    header: 'Details',
                    key: 'url',
                    render: (r) =>
                      r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                        >
                          <span>View</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-dark-400 text-xs">—</span>
                      ),
                  },
                ]}
                data={runs}
                emptyMessage="No workflow runs matching your filter."
              />
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / 20)}
              onPageChange={(p) => fetchWorkflows(p, filterConclusion)}
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* JENKINS CI/CD TAB */}
      {/* ========================================================================= */}
      {activeProvider === 'jenkins' && (
        <div className="space-y-6">
          {jenkinsBanner && (
            <div
              className={`rounded-xl border p-3.5 text-xs font-medium flex items-center justify-between shadow-2xs ${
                jenkinsBanner.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <span>{jenkinsBanner.message}</span>
              <button
                onClick={() => setJenkinsBanner(null)}
                className="font-bold hover:opacity-75 ml-2"
              >
                ×
              </button>
            </div>
          )}

          {isJenkinsLoading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner size="lg" message="Connecting to Jenkins controllers..." />
            </div>
          ) : jenkinsServers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-12 text-center">
              <Server className="h-12 w-12 text-dark-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-dark-100">No Jenkins Controllers Connected</h3>
              <p className="text-xs text-dark-400 mt-1 max-w-sm mx-auto">
                Connect your self-hosted or cloud Jenkins master to view and trigger enterprise pipelines.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => setIsConnectModalOpen(true)}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Connect Jenkins Controller
              </Button>
            </div>
          ) : (
            jenkinsServers.map((server) => (
              <div
                key={server.id}
                className="rounded-2xl border border-[#E5E7EB] bg-white shadow-subtle overflow-hidden space-y-4 p-5"
              >
                {/* Controller Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#F3F4F6] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-dark-100">{server.name}</h2>
                        <Badge
                          variant={server.last_status === 'connected' ? 'success' : 'neutral'}
                          dot
                          className="text-[11px]"
                        >
                          {server.last_status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono text-dark-400 mt-0.5">{server.server_url}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-dark-400">
                    <div>
                      <span className="font-semibold text-dark-200">{server.jobs_count}</span> Pipelines
                    </div>
                    <div>
                      Synced:{' '}
                      <span className="font-semibold text-dark-200">
                        {server.last_synced_at ? new Date(server.last_synced_at).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controller Jobs Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-dark-400 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">Pipeline Name</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Last Build</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {server.jobs.map((job: JenkinsJob) => {
                        const latestBuild: JenkinsBuild | undefined = job.recent_builds?.[0];
                        const isJobTriggering = triggeringJob === job.name;
                        return (
                          <tr key={job.id} className="hover:bg-slate-50/75 transition-colors">
                            <td className="py-3 px-3 font-semibold text-dark-100">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span>{job.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-dark-400 font-mono text-[11px]">
                              {job.job_type === 'workflow-job' ? 'Declarative Pipeline' : 'Freestyle Job'}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-dark-200">
                              #{job.last_build_number || '—'}
                            </td>
                            <td className="py-3 px-3">
                              {getJenkinsBuildBadge(job.last_build_status)}
                            </td>
                            <td className="py-3 px-3 text-dark-300">
                              {latestBuild?.duration_ms
                                ? `${Math.round(latestBuild.duration_ms / 1000)}s`
                                : latestBuild?.status === 'IN_PROGRESS'
                                ? 'Active...'
                                : '—'}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {latestBuild && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      handleViewJenkinsLogs(server.id, job.name, latestBuild.build_number)
                                    }
                                    leftIcon={<Terminal className="h-3 w-3 text-dark-400" />}
                                    className="h-7 text-xs px-2.5"
                                  >
                                    Logs
                                  </Button>
                                )}
                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={isJobTriggering}
                                  onClick={() => handleTriggerJenkins(server.id, job.name)}
                                  leftIcon={
                                    isJobTriggering ? (
                                      <RefreshCw className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Play className="h-3 w-3" />
                                    )
                                  }
                                  className="h-7 text-xs px-2.5"
                                >
                                  {isJobTriggering ? 'Triggering...' : 'Build'}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Dispatch GitHub Pipeline Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Dispatch CI/CD Pipeline">
        <form onSubmit={handleDispatch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-300 mb-1.5 uppercase tracking-wide">
              Target Repository
            </label>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(Number(e.target.value))}
              required
              className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-dark-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-sm"
            >
              {repos.length === 0 ? (
                <option value="">No repositories available</option>
              ) : (
                repos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name}
                  </option>
                ))
              )}
            </select>
          </div>

          <Input
            label="Workflow Name"
            placeholder="e.g. CI / Tests & Lint"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            required
          />

          <Input
            label="Branch / Ref"
            placeholder="e.g. main or feature/xyz"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isDispatching || !selectedRepoId}
              leftIcon={<Play className="h-3.5 w-3.5" />}
            >
              {isDispatching ? 'Triggering...' : 'Trigger Run'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Connect Jenkins Server Modal */}
      <Modal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        title="Connect Jenkins Controller"
      >
        <form onSubmit={handleConnectServer} className="space-y-4">
          <Input
            label="Controller Name"
            placeholder="e.g. Production Jenkins Controller"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            required
          />

          <Input
            label="Jenkins Server URL"
            placeholder="http://jenkins.internal:8080 or https://ci.example.com"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Username"
              placeholder="e.g. admin or devops-bot"
              value={serverUser}
              onChange={(e) => setServerUser(e.target.value)}
            />
            <Input
              label="API Token / Password"
              placeholder="API Token generated in Jenkins"
              type="password"
              value={serverToken}
              onChange={(e) => setServerToken(e.target.value)}
            />
          </div>

          <p className="text-[11px] text-dark-400">
            DevOpsPulse will authenticate against the Jenkins REST API to discover jobs, monitor runs, and trigger pipeline webhooks.
          </p>

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={() => setIsConnectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSavingServer || !serverName || !serverUrl}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              {isSavingServer ? 'Testing & Saving...' : 'Connect Controller'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Jenkins Console Logs Modal */}
      <Modal
        isOpen={logsModal.isOpen}
        onClose={() => setLogsModal((prev) => ({ ...prev, isOpen: false }))}
        title={`Execution Logs: ${logsModal.jobName} #${logsModal.buildNumber}`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-dark-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Real-time console snippet</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copyToClipboard(logsModal.logs)}
              leftIcon={copiedLogs ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              className="h-7 text-xs"
            >
              {copiedLogs ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          {logsModal.isLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="md" message="Streaming logs..." />
            </div>
          ) : (
            <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-800">
              {logsModal.logs}
            </pre>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLogsModal((prev) => ({ ...prev, isOpen: false }))}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WorkflowsPage;
