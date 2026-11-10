import React, { useEffect, useState } from 'react';
import { Rocket, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { workflowService } from '@/services/workflows';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { Deployment } from '@/types';

export const DeploymentsPage: React.FC = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDeployments = async (pageNum: number = 1) => {
    setIsLoading(true);
    try {
      const { data } = await workflowService.getDeployments(pageNum);
      setDeployments(data.deployments || []);
      setTotal(data.total || 0);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load deployments', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments(1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Deployment History
          </h1>
          <p className="text-xs text-dark-400">
            Audit log of environments, deployed commits, and release statuses
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchDeployments(page)}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh Deployments
        </Button>
      </div>

      {/* Deployments Table */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" message="Loading deployments..." />
        </div>
      ) : (
        <div className="rounded-2xl border border-dark-800 bg-dark-900/90 shadow-xl overflow-hidden">
          <Table<Deployment>
            columns={[
              {
                header: 'Environment',
                key: 'environment',
                render: (d) => (
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-primary-400" />
                    <span className="font-semibold text-white capitalize">{d.environment}</span>
                  </div>
                ),
              },
              {
                header: 'Status',
                key: 'status',
                render: (d) => (
                  <Badge
                    variant={d.status === 'success' ? 'success' : 'neutral'}
                    dot={d.status === 'success'}
                  >
                    {d.status}
                  </Badge>
                ),
              },
              {
                header: 'Commit SHA',
                key: 'sha',
                render: (d) => (
                  <span className="font-mono text-xs text-dark-300">
                    {d.sha ? d.sha.substring(0, 7) : d.ref || '—'}
                  </span>
                ),
              },
              {
                header: 'Deployed By',
                key: 'creator',
                render: (d) => <span className="text-xs text-dark-300">{d.creator || 'CI/CD'}</span>,
              },
              {
                header: 'Timestamp',
                key: 'deployed_at',
                render: (d) => (
                  <span className="text-xs text-dark-400">
                    {d.deployed_at
                      ? new Date(d.deployed_at).toLocaleString()
                      : new Date(d.created_at).toLocaleString()}
                  </span>
                ),
              },
            ]}
            data={deployments}
            emptyMessage="No deployments recorded yet. Configure GitHub Deployments or webhooks to track releases."
          />
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / 20)}
          onPageChange={(p) => fetchDeployments(p)}
        />
      )}
    </div>
  );
};
