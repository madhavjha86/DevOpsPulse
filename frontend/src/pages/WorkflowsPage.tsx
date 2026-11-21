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
  Zap,
  Box,
  Layers,
  ShieldCheck,
  Trash2,
  GitCommit,
  CheckCircle,
  XCircle,
  ArrowRight,
  GitBranch,
} from 'lucide-react';
import { workflowService } from '@/services/workflows';
import { repositoryService } from '@/services/repositories';
import {
  jenkinsService,
  type JenkinsServer,
  type JenkinsJob,
  type JenkinsBuild,
} from '@/services/jenkins';
import {
  pipelinesService,
  type Pipeline,
  type PipelineRun,
  type PipelineStage,
  type PipelineStats,
} from '@/services/pipelines';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { WorkflowRun, Repository } from '@/types';

export const WorkflowsPage: React.FC = () => {
  // Active tab: 'pulse' | 'github' | 'jenkins'
  const [activeProvider, setActiveProvider] = useState<'pulse' | 'github' | 'jenkins'>('pulse');

  // PulseCI (Built-in Automation Engine) state
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [isPulseLoading, setIsPulseLoading] = useState<boolean>(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [triggeringPipelineId, setTriggeringPipelineId] = useState<number | null>(null);
  const [pulseBanner, setPulseBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Pipeline modal state
  const [isNewPipelineModalOpen, setIsNewPipelineModalOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('Full-Stack CI/CD Automation');
  const [newPipelineRepo, setNewPipelineRepo] = useState('https://github.com/org/devopspulse-core');
  const [newPipelineBranch, setNewPipelineBranch] = useState('main');
  const [newPipelineTrigger, setNewPipelineTrigger] = useState('PUSH');
  const [newPipelineAutoDeploy, setNewPipelineAutoDeploy] = useState(true);
  const [newPipelineTarget, setNewPipelineTarget] = useState('Kubernetes (Production Cluster)');
  const [isCreatingPipeline, setIsCreatingPipeline] = useState(false);

  // Stage execution log viewer modal
  const [stageLogsModal, setStageLogsModal] = useState<{
    isOpen: boolean;
    stageName: string;
    stageType: string;
    logs: string;
    status: string;
    durationMs: number | null;
    exitCode: number | null;
  }>({
    isOpen: false,
    stageName: '',
    stageType: '',
    logs: '',
    status: '',
    durationMs: null,
    exitCode: null,
  });
  const [copiedStageLogs, setCopiedStageLogs] = useState(false);

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

  const fetchPulseData = async () => {
    setIsPulseLoading(true);
    try {
      const [pipes, stats] = await Promise.all([
        pipelinesService.getPipelines(),
        pipelinesService.getStats(),
      ]);
      setPipelines(pipes);
      setPipelineStats(stats);
      if (pipes.length > 0) {
        setSelectedPipelineId((prev) => (prev ? prev : pipes[0].id));
      }
    } catch (err) {
      console.error('Failed to load Pulse pipelines', err);
    } finally {
      setIsPulseLoading(false);
    }
  };

  const handleTriggerPulseRun = async (pipelineId: number) => {
    setTriggeringPipelineId(pipelineId);
    try {
      const run = await pipelinesService.triggerRun(pipelineId);
      setPulseBanner({
        type: 'success',
        message: `🚀 Automated Run #${run.run_number} triggered! Executing 10 autonomous stages: Clone → Scan → Build → Test → K8s Deploy`,
      });
      await fetchPulseData();
      setSelectedRunId(run.id);
    } catch (err: any) {
      setPulseBanner({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to trigger pipeline',
      });
    } finally {
      setTriggeringPipelineId(null);
    }
  };

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPipeline(true);
    try {
      const newPipe = await pipelinesService.createPipeline({
        name: newPipelineName,
        repo_url: newPipelineRepo,
        branch: newPipelineBranch,
        trigger: newPipelineTrigger,
        auto_deploy: newPipelineAutoDeploy,
        deploy_target: newPipelineTarget,
      });
      setIsNewPipelineModalOpen(false);
      setPulseBanner({
        type: 'success',
        message: `Pipeline "${newPipe.name}" created with 10 standard automated stages!`,
      });
      await fetchPulseData();
      setSelectedPipelineId(newPipe.id);
    } catch (err: any) {
      setPulseBanner({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to create pipeline',
      });
    } finally {
      setIsCreatingPipeline(false);
    }
  };

  const handleDeletePipeline = async (pipelineId: number) => {
    if (!window.confirm('Are you sure you want to delete this pipeline?')) return;
    try {
      await pipelinesService.deletePipeline(pipelineId);
      setPulseBanner({ type: 'success', message: 'Pipeline deleted.' });
      await fetchPulseData();
    } catch (err: any) {
      setPulseBanner({ type: 'error', message: 'Failed to delete pipeline' });
    }
  };

  useEffect(() => {
    void fetchPulseData();
  }, []);

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
    if (activeProvider === 'pulse') {
      void fetchPulseData();
    } else if (activeProvider === 'jenkins') {
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
    void navigator.clipboard.writeText(text);
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

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0] || null;
  const latestRun = selectedPipeline?.runs?.[0] || null;
  const displayedRun = (selectedPipeline?.runs || []).find((r) => r.id === selectedRunId) || latestRun;

  const getStageStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="success" dot className="bg-emerald-50 text-emerald-700 border-emerald-200">PASS</Badge>;
      case 'FAILED':
        return <Badge variant="danger" dot className="bg-rose-50 text-rose-700 border-rose-200">FAIL</Badge>;
      case 'RUNNING':
        return <Badge variant="warning" className="bg-sky-50 text-sky-700 border-sky-200 animate-pulse">RUNNING</Badge>;
      case 'SKIPPED':
        return <Badge variant="neutral" className="bg-slate-100 text-slate-500 border-slate-200">SKIPPED</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getStageIcon = (type: string) => {
    switch (type) {
      case 'SOURCE': return <GitBranch className="w-4 h-4 text-sky-600" />;
      case 'INSTALL': return <Box className="w-4 h-4 text-indigo-600" />;
      case 'SECURITY_SCAN': return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case 'BUILD': return <Layers className="w-4 h-4 text-amber-600" />;
      case 'TEST': return <CheckCircle className="w-4 h-4 text-teal-600" />;
      case 'LINT': return <CheckCircle2 className="w-4 h-4 text-cyan-600" />;
      case 'DOCKER_BUILD': return <Box className="w-4 h-4 text-blue-600" />;
      case 'PUSH_REGISTRY': return <ArrowRight className="w-4 h-4 text-purple-600" />;
      case 'DEPLOY': return <Play className="w-4 h-4 text-emerald-600" />;
      case 'NOTIFY': return <Check className="w-4 h-4 text-green-600" />;
      default: return <Zap className="w-4 h-4 text-slate-600" />;
    }
  };

  const formatDurationMs = (ms: number | null | undefined) => {
    if (!ms) return '0s';
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}m ${rem}s`;
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
          {activeProvider === 'pulse' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchPulseData}
                leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isPulseLoading ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsNewPipelineModalOpen(true)}
                leftIcon={<Plus className="h-3.5 w-3.5" />}
              >
                New Automated Pipeline
              </Button>
            </>
          )}

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
          onClick={() => setActiveProvider('pulse')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeProvider === 'pulse'
              ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
              : 'bg-white border border-[#E5E7EB] text-dark-300 hover:text-dark-100 hover:bg-slate-50'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          PulseCI Engine (Built-in Automated) ({pipelines.length})
        </button>
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
      {/* PULSE CI/CD ENGINE (BUILT-IN AUTOMATION) */}
      {/* ========================================================================= */}
      {activeProvider === 'pulse' && (
        <div className="space-y-6">
          {pulseBanner && (
            <div
              className={`rounded-xl border p-3.5 text-xs font-medium flex items-center justify-between shadow-2xs ${
                pulseBanner.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {pulseBanner.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{pulseBanner.message}</span>
              </div>
              <button
                onClick={() => setPulseBanner(null)}
                className="font-bold text-dark-400 hover:text-dark-100 ml-2"
              >
                ×
              </button>
            </div>
          )}

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
              <span className="text-[11px] font-bold text-dark-400 uppercase tracking-wider block">
                Automated Pipelines
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-dark-100">
                  {pipelineStats?.total_pipelines ?? pipelines.length}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-700">
                  Active
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
              <span className="text-[11px] font-bold text-dark-400 uppercase tracking-wider block">
                Total Runs Executed
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-dark-100">
                  {pipelineStats?.total_runs ?? 0}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  Automated
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
              <span className="text-[11px] font-bold text-dark-400 uppercase tracking-wider block">
                Success Rate
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600">
                  {pipelineStats?.success_rate ?? 100}%
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  Reliability
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
              <span className="text-[11px] font-bold text-dark-400 uppercase tracking-wider block">
                Average Duration
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-dark-100">
                  {formatDurationMs(pipelineStats?.avg_duration_ms)}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  Zero-Touch
                </span>
              </div>
            </div>
          </div>

          {/* Pipeline Selector Switcher */}
          {pipelines.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-dark-400 uppercase mr-1">Pipeline:</span>
              {pipelines.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPipelineId(p.id);
                    setSelectedRunId(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    selectedPipeline?.id === p.id
                      ? 'bg-dark-100 text-white shadow-xs'
                      : 'bg-white border border-[#E5E7EB] text-dark-300 hover:text-dark-100 hover:bg-slate-50'
                  }`}
                >
                  <Zap className={`w-3 h-3 ${selectedPipeline?.id === p.id ? 'text-amber-400 fill-amber-400' : 'text-dark-400'}`} />
                  <span>{p.name}</span>
                  <span className="text-[10px] opacity-75 font-mono">({p.branch})</span>
                </button>
              ))}
            </div>
          )}

          {/* Main Visualizer Container for Selected Pipeline */}
          {selectedPipeline ? (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-6">
              {/* Header Info Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg font-black text-dark-100 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
                      {selectedPipeline.name}
                    </h2>
                    <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5">
                      AUTONOMOUS ENGINE
                    </span>
                    {selectedPipeline.auto_deploy && (
                      <span className="rounded-full bg-primary-50 text-primary-700 border border-primary-200 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Auto-Deploy K8s
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-dark-400 mt-1 flex items-center gap-2 flex-wrap">
                    <span>Repo: <code className="font-mono text-dark-200">{selectedPipeline.repo_url || 'N/A'}</code></span>
                    <span>&bull;</span>
                    <span>Branch: <code className="font-mono font-bold text-dark-200">{selectedPipeline.branch}</code></span>
                    <span>&bull;</span>
                    <span>Target: <strong className="text-dark-100">{selectedPipeline.deploy_target || 'Kubernetes'}</strong></span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleTriggerPulseRun(selectedPipeline.id)}
                    disabled={triggeringPipelineId === selectedPipeline.id}
                    leftIcon={
                      triggeringPipelineId === selectedPipeline.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current" />
                      )
                    }
                  >
                    {triggeringPipelineId === selectedPipeline.id
                      ? 'Executing 10 Stages...'
                      : 'Trigger Full Pipeline'}
                  </Button>
                </div>
              </div>

              {/* Run Selector & Summary */}
              {displayedRun ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 font-mono font-bold text-dark-100">
                        <span className="text-sm font-black text-primary-700">Run #{displayedRun.run_number}</span>
                        <span className="text-dark-400">&bull;</span>
                        <span className="flex items-center gap-1 font-mono text-[11px] text-dark-300">
                          <GitCommit className="w-3.5 h-3.5 text-dark-400" />
                          {(displayedRun.commit_sha || '').slice(0, 7) || 'HEAD'}
                        </span>
                      </div>
                      <span className="text-dark-400">|</span>
                      <span className="text-dark-200 font-medium truncate max-w-xs sm:max-w-md">
                        "{displayedRun.commit_message || 'Pipeline build'}"
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-dark-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDurationMs(displayedRun.duration_ms)}
                      </span>
                      {displayedRun.status === 'SUCCESS' ? (
                        <Badge variant="success" dot className="bg-emerald-100/80 text-emerald-800 font-bold">
                          PIPELINE PASSED
                        </Badge>
                      ) : (
                        <Badge variant="danger" dot className="bg-rose-100/80 text-rose-800 font-bold">
                          PIPELINE FAILED
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 10-Stage Pipeline Horizontal Flowchart */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-dark-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        Automated 10-Stage Progression Graph
                      </h3>
                      <span className="text-[11px] text-dark-400">
                        Click on any stage to inspect real terminal logs
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {displayedRun.stages.map((stage, idx) => (
                        <div
                          key={stage.id}
                          onClick={() =>
                            setStageLogsModal({
                              isOpen: true,
                              stageName: stage.name,
                              stageType: stage.stage_type,
                              logs: stage.logs || 'No logs available.',
                              status: stage.status,
                              durationMs: stage.duration_ms,
                              exitCode: stage.exit_code,
                            })
                          }
                          className={`group cursor-pointer rounded-xl p-3 border transition-all duration-150 hover:shadow-md relative ${
                            stage.status === 'SUCCESS'
                              ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400'
                              : stage.status === 'FAILED'
                              ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
                              : 'bg-slate-50/50 border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-[10px] font-mono font-bold text-dark-400">
                              0{idx + 1}
                            </span>
                            {getStageStatusBadge(stage.status)}
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-white border border-[#E5E7EB] shadow-2xs group-hover:scale-105 transition-transform">
                              {getStageIcon(stage.stage_type)}
                            </div>
                            <span className="text-xs font-bold text-dark-100 truncate group-hover:text-primary-700 transition-colors">
                              {stage.name}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-dark-400 font-mono pt-1 border-t border-black/5">
                            <span>{formatDurationMs(stage.duration_ms)}</span>
                            <span className="text-[10px] text-primary-600 font-sans font-semibold group-hover:underline flex items-center gap-0.5">
                              Logs <Terminal className="w-2.5 h-2.5" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Run History Selector Table */}
                  {selectedPipeline.runs.length > 1 && (
                    <div className="pt-4 border-t border-[#E5E7EB]">
                      <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-2">
                        Execution History ({selectedPipeline.runs.length} Runs)
                      </h4>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {selectedPipeline.runs.map((r) => (
                          <div
                            key={r.id}
                            onClick={() => setSelectedRunId(r.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                              displayedRun.id === r.id
                                ? 'bg-primary-50 border-primary-200 font-bold text-primary-900'
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-dark-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono">#{r.run_number}</span>
                              <span className="font-mono text-[11px] text-dark-400">{(r.commit_sha || '').slice(0, 7)}</span>
                              <span className="truncate max-w-xs">{r.commit_message}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-[11px] text-dark-400">{formatDurationMs(r.duration_ms)}</span>
                              {r.status === 'SUCCESS' ? (
                                <Badge variant="success" dot>SUCCESS</Badge>
                              ) : (
                                <Badge variant="danger" dot>FAILED</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-dark-400">
                  No execution runs yet. Click "Trigger Full Pipeline" to start.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-12 text-center">
              <Zap className="h-10 w-10 text-dark-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-dark-100">No Automated Pipelines Found</h3>
              <p className="text-xs text-dark-400 mt-1 max-w-sm mx-auto">
                Create your first automated pipeline to enable zero-touch CI/CD from Git push to Kubernetes deployment.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => setIsNewPipelineModalOpen(true)}
                leftIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Create Pipeline
              </Button>
            </div>
          )}
        </div>
      )}

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

      {/* PulseCI: New Automated Pipeline Modal */}
      <Modal
        isOpen={isNewPipelineModalOpen}
        onClose={() => setIsNewPipelineModalOpen(false)}
        title="Create Autonomous CI/CD Pipeline"
      >
        <form onSubmit={handleCreatePipeline} className="space-y-4">
          <Input
            label="Pipeline Name"
            placeholder="e.g. Microservice Production Pipeline"
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
            required
          />

          <Input
            label="Git Repository URL"
            placeholder="https://github.com/org/repo"
            value={newPipelineRepo}
            onChange={(e) => setNewPipelineRepo(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Branch"
              placeholder="main"
              value={newPipelineBranch}
              onChange={(e) => setNewPipelineBranch(e.target.value)}
              required
            />
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Trigger Event</label>
              <select
                value={newPipelineTrigger}
                onChange={(e) => setNewPipelineTrigger(e.target.value)}
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-semibold text-dark-100 focus:outline-hidden"
              >
                <option value="PUSH">Git Push (Automatic)</option>
                <option value="PULL_REQUEST">Pull Request (PR Validation)</option>
                <option value="MANUAL">Manual Trigger Only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Deployment Target</label>
            <select
              value={newPipelineTarget}
              onChange={(e) => setNewPipelineTarget(e.target.value)}
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-semibold text-dark-100 focus:outline-hidden"
            >
              <option value="Kubernetes (Production Cluster)">Kubernetes (Production Cluster)</option>
              <option value="Docker Host (Local Engine)">Docker Host (Local Engine)</option>
              <option value="AWS ECS Fargate">AWS ECS Fargate</option>
              <option value="Google Cloud Run">Google Cloud Run</option>
            </select>
          </div>

          <label className="flex items-center gap-2 p-3 rounded-xl border border-emerald-100 bg-emerald-50/60 cursor-pointer">
            <input
              type="checkbox"
              checked={newPipelineAutoDeploy}
              onChange={(e) => setNewPipelineAutoDeploy(e.target.checked)}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <div className="text-xs">
              <span className="font-bold text-emerald-900 block">Enable Auto-Deploy to Production</span>
              <span className="text-[11px] text-emerald-700">
                Automatically builds Docker image & deploys to cluster when all test & security checks pass.
              </span>
            </div>
          </label>

          <p className="text-[11px] text-dark-400">
            This pipeline will automatically provision 10 standardized enterprise stages: Clone Source, Install Dependencies, Security Scan, Build, Unit Tests, Linting, Docker Image Build, Registry Push, Kubernetes Rollout, and Slack/Email Notification.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
            <Button type="button" variant="secondary" onClick={() => setIsNewPipelineModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isCreatingPipeline || !newPipelineName}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              {isCreatingPipeline ? 'Provisioning...' : 'Provision Pipeline'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* PulseCI: Stage Execution Terminal Logs Modal */}
      <Modal
        isOpen={stageLogsModal.isOpen}
        onClose={() => setStageLogsModal((prev) => ({ ...prev, isOpen: false }))}
        title={`Stage Logs: ${stageLogsModal.stageName} (${stageLogsModal.stageType})`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-dark-400">
              <Terminal className="w-3.5 h-3.5" />
              <span>
                Status: <strong className="text-dark-100 uppercase">{stageLogsModal.status}</strong>
                {stageLogsModal.durationMs && ` • Duration: ${(stageLogsModal.durationMs / 1000).toFixed(1)}s`}
                {stageLogsModal.exitCode !== null && ` • Exit Code: ${stageLogsModal.exitCode}`}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(stageLogsModal.logs);
                setCopiedStageLogs(true);
                setTimeout(() => setCopiedStageLogs(false), 2000);
              }}
              leftIcon={copiedStageLogs ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              className="h-7 text-xs"
            >
              {copiedStageLogs ? 'Copied!' : 'Copy Logs'}
            </Button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-800">
            {stageLogsModal.logs}
          </pre>

          <div className="flex justify-end pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStageLogsModal((prev) => ({ ...prev, isOpen: false }))}
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
