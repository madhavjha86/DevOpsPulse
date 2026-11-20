import React, { useEffect, useState } from 'react';
import {
  GitBranch,
  ExternalLink,
  RefreshCw,
  Play,
} from 'lucide-react';
import { workflowService } from '@/services/workflows';
import { repositoryService } from '@/services/repositories';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { WorkflowRun, Repository } from '@/types';

export const WorkflowsPage: React.FC = () => {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [filterConclusion, setFilterConclusion] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAutoPolling, setIsAutoPolling] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());

  // Dispatch modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<number | ''>('');
  const [workflowName, setWorkflowName] = useState('CI / Tests & Lint');
  const [branch, setBranch] = useState('main');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

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
      setLastSyncedAt(new Date());
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
        setLastSyncedAt(new Date());
      }
    } catch (err) {
      console.warn('Silent workflows poll failed:', err);
    } finally {
      setIsAutoPolling(false);
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

  // Real-time polling: 6 seconds if running jobs exist; 20 seconds otherwise
  useEffect(() => {
    const intervalMs = hasActiveRuns ? 6000 : 20000;
    const timer = setInterval(() => {
      void silentPollWorkflows();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [page, filterConclusion, hasActiveRuns]);

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

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100">CI/CD Workflows</h1>
          <p className="text-xs font-medium text-dark-400 mt-0.5">
            Real-time GitHub Actions workflow run monitoring ({total} total runs)
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Live Telemetry Indicator */}
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
            Refresh Runs
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Play className="h-3.5 w-3.5" />}
          >
            Dispatch Pipeline
          </Button>
        </div>
      </div>

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
            onClick={() => {
              setFilterConclusion(tab.key);
            }}
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

      {/* Dispatch Pipeline Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Dispatch CI/CD Pipeline">
        <form onSubmit={handleDispatch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-300 mb-1.5 uppercase tracking-wide">Target Repository</label>
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
    </div>
  );
};

export default WorkflowsPage;
