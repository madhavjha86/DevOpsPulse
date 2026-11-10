import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  GitCommit,
  GitPullRequest,
  AlertCircle,
  GitBranch,
  Star,
  GitFork,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { repositoryService } from '@/services/repositories';
import { workflowService } from '@/services/workflows';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { Repository, Commit, PullRequest, Issue, WorkflowRun } from '@/types';

type TabType = 'workflows' | 'commits' | 'pull-requests' | 'issues';

export const RepositoryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const repoId = Number(id);
  const navigate = useNavigate();

  const [repo, setRepo] = useState<Repository | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('workflows');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Tab data
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);

  const fetchRepoData = async () => {
    if (!repoId) return;
    setIsLoading(true);
    try {
      const { data: repoData } = await repositoryService.getById(repoId);
      setRepo(repoData);

      // Fetch tab data in parallel
      const [wfRes, cmRes, prRes, isRes] = await Promise.all([
        workflowService.getByRepository(repoId, 1),
        repositoryService.getCommits(repoId, 1, 30),
        repositoryService.getPullRequests(repoId, 1, 30),
        repositoryService.getIssues(repoId, 1, 30),
      ]);

      setWorkflows(wfRes.data.workflow_runs || []);
      setCommits(cmRes.data || []);
      setPrs(prRes.data || []);
      setIssues(isRes.data || []);
    } catch (err) {
      console.error('Failed to load repo detail', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRepoData();
  }, [repoId]);

  const handleManualSync = async () => {
    if (!repoId) return;
    setIsSyncing(true);
    try {
      await repositoryService.syncRepo(repoId);
      await workflowService.syncByRepository(repoId);
      await fetchRepoData();
    } catch (err) {
      console.error('Failed to sync repo', err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading && !repo) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" message="Loading repository data..." />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-dark-300">Repository not found.</p>
        <Button variant="secondary" onClick={() => navigate('/repositories')}>
          Back to Repositories
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button & Top Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/repositories')}
          className="flex items-center gap-2 text-xs font-semibold text-dark-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Repositories</span>
        </button>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleManualSync}
            isLoading={isSyncing}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
          >
            Sync from GitHub
          </Button>
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-dark-700/80 bg-dark-800 px-3 py-1.5 text-xs font-medium text-dark-200 hover:bg-dark-700 hover:text-white transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>GitHub</span>
          </a>
        </div>
      </div>

      {/* Repo Header Card */}
      <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{repo.full_name}</h1>
            <p className="mt-1 text-xs text-dark-400">{repo.description || 'No description'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs rounded-full bg-dark-800 px-3 py-1 text-dark-300 border border-dark-700/60 font-mono">
              <GitBranch className="h-3.5 w-3.5 text-primary-400" />
              {repo.default_branch}
            </span>
            <span className="flex items-center gap-1 text-xs rounded-full bg-dark-800 px-3 py-1 text-dark-300 border border-dark-700/60">
              <Star className="h-3.5 w-3.5 text-warning-400" />
              {repo.stars_count}
            </span>
            <span className="flex items-center gap-1 text-xs rounded-full bg-dark-800 px-3 py-1 text-dark-300 border border-dark-700/60">
              <GitFork className="h-3.5 w-3.5 text-primary-400" />
              {repo.forks_count}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-dark-800">
        <nav className="flex space-x-6">
          {[
            { key: 'workflows', label: 'Workflows', count: workflows.length },
            { key: 'commits', label: 'Commits', count: commits.length },
            { key: 'pull-requests', label: 'Pull Requests', count: prs.length },
            { key: 'issues', label: 'Issues', count: issues.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`flex items-center gap-2 border-b-2 py-3 text-xs font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-dark-400 hover:border-dark-700 hover:text-dark-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="rounded-full bg-dark-800 px-2 py-0.5 text-[10px] text-dark-300">
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Contents */}
      {activeTab === 'workflows' && (
        <div className="rounded-2xl border border-dark-800 bg-dark-900/90 shadow-xl overflow-hidden">
          <Table<WorkflowRun>
            columns={[
              {
                header: 'Run',
                key: 'workflow_name',
                render: (r) => (
                  <div>
                    <span className="font-semibold text-white">{r.workflow_name}</span>
                    <span className="ml-2 font-mono text-xs text-dark-400">#{r.run_number}</span>
                  </div>
                ),
              },
              {
                header: 'Status',
                key: 'conclusion',
                render: (r) => {
                  const state = r.conclusion || r.status;
                  const variant =
                    state === 'success'
                      ? 'success'
                      : state === 'failure'
                      ? 'danger'
                      : 'warning';
                  return <Badge variant={variant}>{state}</Badge>;
                },
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
                  <span className="text-xs text-dark-400">
                    {r.duration_seconds ? `${r.duration_seconds}s` : '—'}
                  </span>
                ),
              },
              {
                header: 'Completed',
                key: 'completed_at',
                render: (r) => (
                  <span className="text-xs text-dark-400">
                    {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}
                  </span>
                ),
              },
            ]}
            data={workflows}
            emptyMessage="No GitHub Actions workflow runs recorded."
          />
        </div>
      )}

      {activeTab === 'commits' && (
        <div className="rounded-2xl border border-dark-800 bg-dark-900/90 shadow-xl overflow-hidden">
          <Table<Commit>
            columns={[
              {
                header: 'SHA',
                key: 'sha',
                render: (c) => (
                  <span className="font-mono text-xs text-primary-400">{c.sha.substring(0, 7)}</span>
                ),
              },
              {
                header: 'Message',
                key: 'message',
                render: (c) => (
                  <span className="font-medium text-dark-200 line-clamp-1">
                    {c.message.split('\n')[0]}
                  </span>
                ),
              },
              {
                header: 'Author',
                key: 'author_name',
                render: (c) => <span className="text-xs text-dark-300">{c.author_name}</span>,
              },
              {
                header: 'Date',
                key: 'author_date',
                render: (c) => (
                  <span className="text-xs text-dark-400">
                    {new Date(c.author_date).toLocaleDateString()}
                  </span>
                ),
              },
            ]}
            data={commits}
            emptyMessage="No commits found."
          />
        </div>
      )}

      {activeTab === 'pull-requests' && (
        <div className="rounded-2xl border border-dark-800 bg-dark-900/90 shadow-xl overflow-hidden">
          <Table<PullRequest>
            columns={[
              {
                header: '#',
                key: 'number',
                render: (p) => <span className="font-mono text-xs text-dark-400">#{p.number}</span>,
              },
              {
                header: 'Title',
                key: 'title',
                render: (p) => <span className="font-medium text-white">{p.title}</span>,
              },
              {
                header: 'State',
                key: 'state',
                render: (p) => {
                  const variant =
                    p.state === 'closed'
                      ? 'neutral'
                      : p.state === 'merged'
                      ? 'info'
                      : 'success';
                  return <Badge variant={variant}>{p.state}</Badge>;
                },
              },
              {
                header: 'Author',
                key: 'author',
                render: (p) => <span className="text-xs text-dark-300">{p.author || '—'}</span>,
              },
            ]}
            data={prs}
            emptyMessage="No pull requests found."
          />
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="rounded-2xl border border-dark-800 bg-dark-900/90 shadow-xl overflow-hidden">
          <Table<Issue>
            columns={[
              {
                header: '#',
                key: 'number',
                render: (i) => <span className="font-mono text-xs text-dark-400">#{i.number}</span>,
              },
              {
                header: 'Title',
                key: 'title',
                render: (i) => <span className="font-medium text-white">{i.title}</span>,
              },
              {
                header: 'State',
                key: 'state',
                render: (i) => {
                  const variant = i.state === 'open' ? 'danger' : 'neutral';
                  return <Badge variant={variant}>{i.state}</Badge>;
                },
              },
              {
                header: 'Author',
                key: 'author',
                render: (i) => <span className="text-xs text-dark-300">{i.author || '—'}</span>,
              },
            ]}
            data={issues}
            emptyMessage="No issues found."
          />
        </div>
      )}
    </div>
  );
};
