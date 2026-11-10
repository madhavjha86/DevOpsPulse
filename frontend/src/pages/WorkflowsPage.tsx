import React, { useEffect, useState } from 'react';
import {
  GitBranch,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Filter,
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

  // Dispatch modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<number | ''>('');
  const [workflowName, setWorkflowName] = useState('CI / Tests & Lint');
  const [branch, setBranch] = useState('main');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    fetchWorkflows(1, filterConclusion);
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
      fetchWorkflows(1, filterConclusion);
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
        <Badge variant="success" dot>
          Success
        </Badge>
      );
    }
    if (outcome === 'failure') {
      return (
        <Badge variant="danger" dot>
          Failed
        </Badge>
      );
    }
    if (outcome === 'in_progress') {
      return (
        <Badge variant="warning" dot>
          Running
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">CI/CD Workflows</h1>
          <p className="text-xs text-dark-400">
            Real-time GitHub Actions workflow run monitoring ({total} total runs)
          </p>
        </div>
        <div className="flex items-center gap-3">
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
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-between">
          <span>{dispatchSuccess}</span>
          <button onClick={() => setDispatchSuccess(null)} className="text-dark-400 hover:text-white">
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
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filterConclusion === tab.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-dark-900 border border-dark-800 text-dark-400 hover:text-white hover:bg-dark-800'
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
        <div className="rounded-2xl border border-dark-800 bg-dark-900/90 shadow-xl overflow-hidden">
          <Table<WorkflowRun>
            columns={[
              {
                header: 'Workflow / Run',
                key: 'workflow_name',
                render: (r) => (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{r.workflow_name}</span>
                      <span className="font-mono text-xs text-dark-400">#{r.run_number}</span>
                    </div>
                    <span className="text-[10px] text-dark-400 uppercase tracking-wider font-mono">
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
                  <span className="font-mono text-xs text-dark-300">{r.branch || 'main'}</span>
                ),
              },
              {
                header: 'Duration',
                key: 'duration_seconds',
                render: (r) => (
                  <span className="text-xs text-dark-300">
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
                  <span className="text-xs text-dark-400">
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
                      className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
                    >
                      <span>View</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-dark-500 text-xs">—</span>
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
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Target Repository</label>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-dark-700 bg-dark-900/80 px-3 py-2 text-xs text-white focus:border-primary-500 focus:outline-none"
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
