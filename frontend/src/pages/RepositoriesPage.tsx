import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  GitFork,
  Star,
  RefreshCw,
  Trash2,
  ExternalLink,
  Search,
  Lock,
  Globe,
  Circle,
} from 'lucide-react';
import { repositoryService } from '@/services/repositories';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { Repository } from '@/types';

export const RepositoriesPage: React.FC = () => {
  const navigate = useNavigate();

  const [repos, setRepos] = useState<Repository[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Import Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [repoFullName, setRepoFullName] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Syncing tracker
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const fetchRepositories = async (pageNum: number = 1) => {
    setIsLoading(true);
    try {
      const { data } = await repositoryService.getAll(pageNum, 12);
      setRepos(data.repositories || []);
      setTotal(data.total || 0);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load repositories', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositories(1);
  }, []);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setIsImporting(true);

    let cleanName = repoFullName.trim();
    // Auto-strip full GitHub URL if pasted
    cleanName = cleanName
      .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '');

    try {
      await repositoryService.importRepo(cleanName);
      setIsModalOpen(false);
      setRepoFullName('');
      fetchRepositories(1);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      let msg = 'Failed to import repository from GitHub.';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        msg = detail
          .map((d: any) => {
            if (d.type === 'string_pattern_mismatch' || (d.msg && d.msg.includes('match pattern'))) {
              return "Invalid repository format. Please enter 'owner/repo' (e.g. pallets/flask) or paste a GitHub repository URL.";
            }
            return d.msg || 'Validation error';
          })
          .join('. ');
      }
      setImportError(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSync = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setSyncingId(id);
    try {
      await repositoryService.syncRepo(id);
      await fetchRepositories(page);
    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this repository from DevOpsPulse?')) {
      return;
    }
    try {
      await repositoryService.deleteRepo(id);
      fetchRepositories(page);
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.language && r.language.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Repositories</h1>
          <p className="text-xs text-dark-400">
            Connected GitHub repositories being monitored ({total} total)
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setImportError(null);
            setIsModalOpen(true);
          }}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Import Repository
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            placeholder="Filter by repository name or language..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-dark-800 bg-dark-900 py-2 pl-9 pr-4 text-xs text-white placeholder-dark-400 focus:border-primary-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Repository Cards Grid */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" message="Loading repositories..." />
        </div>
      ) : filteredRepos.length === 0 ? (
        <EmptyState
          icon={GitFork}
          title="No Repositories Found"
          description={
            searchQuery
              ? 'No repositories match your search criteria.'
              : 'Connect your GitHub repositories to track CI/CD runs, commits, and pull requests.'
          }
          action={{
            label: 'Import Repository',
            onClick: () => setIsModalOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRepos.map((repo) => (
            <div
              key={repo.id}
              onClick={() => navigate(`/repositories/${repo.id}`)}
              className="cursor-pointer rounded-2xl border border-dark-800 bg-dark-900/90 p-5 shadow-lg hover:border-dark-700 hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                {/* Title & Privacy Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {repo.is_private ? (
                      <Lock className="h-4 w-4 text-warning-400 shrink-0" />
                    ) : (
                      <Globe className="h-4 w-4 text-dark-400 shrink-0" />
                    )}
                    <h3 className="font-semibold text-sm text-white truncate hover:text-primary-400 transition-colors">
                      {repo.name}
                    </h3>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-dark-800 text-dark-400 border border-dark-700/50">
                    {repo.default_branch}
                  </span>
                </div>

                <p className="mt-1 text-xs text-dark-400 line-clamp-2 min-h-[32px]">
                  {repo.description || 'No description provided.'}
                </p>
              </div>

              {/* Stats & Actions Footer */}
              <div className="mt-4 pt-4 border-t border-dark-800 flex items-center justify-between text-xs text-dark-400">
                <div className="flex items-center gap-3">
                  {repo.language && (
                    <span className="flex items-center gap-1 text-dark-300">
                      <Circle className="h-2 w-2 fill-primary-400 text-primary-400" />
                      {repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-warning-400" />
                    {repo.stars_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork className="h-3.5 w-3.5" />
                    {repo.forks_count}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleSync(e, repo.id)}
                    title="Sync now"
                    disabled={syncingId === repo.id}
                    className="p-1.5 rounded-md text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${syncingId === repo.id ? 'animate-spin text-primary-400' : ''}`}
                    />
                  </button>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Open on GitHub"
                    className="p-1.5 rounded-md text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={(e) => handleDelete(e, repo.id)}
                    title="Remove repository"
                    className="p-1.5 rounded-md text-dark-400 hover:text-danger-400 hover:bg-dark-800 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 12 && (
        <div className="mt-6">
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / 12)}
            onPageChange={(p) => fetchRepositories(p)}
          />
        </div>
      )}

      {/* Import Repository Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Import GitHub Repository"
      >
        <form onSubmit={handleImport} className="space-y-4">
          <p className="text-xs text-dark-400">
            Enter the repository full name in the format <code className="text-primary-300">owner/repo</code> (e.g.{' '}
            <code className="text-primary-300">facebook/react</code>).
          </p>

          {importError && (
            <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-300">
              {importError}
            </div>
          )}

          <Input
            label="Repository Name"
            placeholder="owner/repo"
            value={repoFullName}
            onChange={(e) => setRepoFullName(e.target.value)}
            required
            autoFocus
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isImporting}>
              Import & Sync
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
