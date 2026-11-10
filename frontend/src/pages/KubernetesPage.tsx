import React, { useEffect, useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Trash2,
  Server,
  Activity,
  Layers,
  Cpu,
  Database,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  kubernetesService,
  K8sCluster,
  K8sOverview,
  K8sNode,
  K8sPod,
} from '../services/kubernetes';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function KubernetesPage() {
  const [clusters, setClusters] = useState<K8sCluster[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [overview, setOverview] = useState<K8sOverview | null>(null);
  const [nodes, setNodes] = useState<K8sNode[]>([]);
  const [pods, setPods] = useState<K8sPod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'pods' | 'nodes'>('pods');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [podStatusFilter, setPodStatusFilter] = useState<'all' | 'running' | 'pending' | 'failed' | 'crashloop'>('all');

  // Add Cluster Modal
  const [isAddClusterOpen, setIsAddClusterOpen] = useState(false);
  const [clusterName, setClusterName] = useState('');
  const [apiServerUrl, setApiServerUrl] = useState('https://127.0.0.1:6443');
  const [bearerToken, setBearerToken] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState('all');
  const [tlsVerify, setTlsVerify] = useState(false);
  const [addClusterLoading, setAddClusterLoading] = useState(false);
  const [addClusterError, setAddClusterError] = useState('');

  // Pod Logs Modal
  const [activeLogPod, setActiveLogPod] = useState<K8sPod | null>(null);
  const [podLogs, setPodLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsTail, setLogsTail] = useState(100);
  const [logSearch, setLogSearch] = useState('');
  const [copiedLog, setCopiedLog] = useState(false);

  const selectedCluster = useMemo(
    () => clusters.find((c) => c.id === selectedClusterId) || null,
    [clusters, selectedClusterId]
  );

  const fetchClusters = async () => {
    try {
      const data = await kubernetesService.getClusters();
      setClusters(data);
      if (data.length > 0 && !selectedClusterId) {
        setSelectedClusterId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load Kubernetes clusters', err);
    }
  };

  const fetchClusterResources = async (clusterId: number) => {
    try {
      setRefreshing(true);
      const [ovData, nodesData, podsData] = await Promise.all([
        kubernetesService.getOverview(clusterId),
        kubernetesService.getNodes(clusterId),
        kubernetesService.getPods(clusterId, selectedNamespace),
      ]);
      setOverview(ovData);
      setNodes(nodesData);
      setPods(podsData);

      // Update cluster status in local list
      setClusters((prev) =>
        prev.map((c) =>
          c.id === clusterId
            ? {
                ...c,
                last_status: ovData.cluster_status as K8sCluster['last_status'],
                k8s_version: ovData.k8s_version,
                nodes_count: ovData.nodes_total,
                pods_count: ovData.pods_total,
              }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to load cluster resources', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, []);

  useEffect(() => {
    if (selectedClusterId) {
      fetchClusterResources(selectedClusterId);
    }
  }, [selectedClusterId, selectedNamespace]);

  const handleAddCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clusterName.trim() || !apiServerUrl.trim()) return;

    setAddClusterLoading(true);
    setAddClusterError('');
    try {
      const created = await kubernetesService.createCluster({
        name: clusterName.trim(),
        api_server_url: apiServerUrl.trim(),
        bearer_token: bearerToken.trim() || undefined,
        namespace_filter: namespaceFilter.trim() || 'all',
        tls_verify: tlsVerify,
      });
      setClusters((prev) => [created, ...prev]);
      setSelectedClusterId(created.id);
      setIsAddClusterOpen(false);
      setClusterName('');
      setApiServerUrl('https://127.0.0.1:6443');
      setBearerToken('');
      setNamespaceFilter('all');
      setTlsVerify(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register cluster';
      setAddClusterError(msg);
    } finally {
      setAddClusterLoading(false);
    }
  };

  const handleDeleteCluster = async (clusterId: number) => {
    if (!window.confirm('Are you sure you want to remove this Kubernetes cluster?')) return;
    try {
      await kubernetesService.deleteCluster(clusterId);
      setClusters((prev) => prev.filter((c) => c.id !== clusterId));
      if (selectedClusterId === clusterId) {
        const remaining = clusters.filter((c) => c.id !== clusterId);
        setSelectedClusterId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete cluster', err);
    }
  };

  const openPodLogs = async (pod: K8sPod) => {
    if (!selectedClusterId) return;
    setActiveLogPod(pod);
    setPodLogs([]);
    setLogsLoading(true);
    try {
      const res = await kubernetesService.getPodLogs(
        selectedClusterId,
        pod.name,
        pod.namespace,
        logsTail
      );
      setPodLogs(res.lines || []);
    } catch (err) {
      setPodLogs([`Failed to stream pod logs: ${err}`]);
    } finally {
      setLogsLoading(false);
    }
  };

  const refreshPodLogs = async () => {
    if (!selectedClusterId || !activeLogPod) return;
    setLogsLoading(true);
    try {
      const res = await kubernetesService.getPodLogs(
        selectedClusterId,
        activeLogPod.name,
        activeLogPod.namespace,
        logsTail
      );
      setPodLogs(res.lines || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(podLogs.join('\n'));
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const filteredPods = useMemo(() => {
    return pods.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.node_name && p.node_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        podStatusFilter === 'all'
          ? true
          : podStatusFilter === 'running'
          ? p.phase === 'Running'
          : podStatusFilter === 'pending'
          ? p.phase === 'Pending'
          : podStatusFilter === 'failed'
          ? p.phase === 'Failed'
          : p.is_crash_loop || p.is_oom_killed;

      return matchesSearch && matchesStatus;
    });
  }, [pods, searchQuery, podStatusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-2">
            <Boxes className="h-7 w-7 text-primary-500" />
            Kubernetes Cluster Monitoring
          </h1>
          <p className="text-sm text-dark-400 mt-1">
            Real-time cluster telemetry, node capacity, pod health diagnostics, and CrashLoopBackOff detection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => selectedClusterId && fetchClusterResources(selectedClusterId)}
            isLoading={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddClusterOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Connect Cluster
          </Button>
        </div>
      </div>

      {/* Cluster Selector & Health Bar */}
      <div className="glass-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label htmlFor="cluster-selector" className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
              Cluster:
            </label>
            <select
              id="cluster-selector"
              aria-label="Select Kubernetes Cluster"
              value={selectedClusterId || ''}
              onChange={(e) => setSelectedClusterId(Number(e.target.value))}
              className="bg-white text-dark-100 text-sm rounded-xl border border-[#E5E7EB] px-3 py-1.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 shadow-sm"
            >
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.api_server_url})
                </option>
              ))}
            </select>

            {selectedCluster && (
              <Badge
                variant={
                  selectedCluster.last_status === 'connected'
                    ? 'success'
                    : selectedCluster.last_status === 'unreachable'
                    ? 'warning'
                    : 'danger'
                }
                dot
              >
                {selectedCluster.last_status.toUpperCase()}
              </Badge>
            )}
          </div>

          {selectedCluster && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-dark-400">
              {selectedCluster.k8s_version && (
                <span>
                  K8s Version: <strong className="text-dark-200">{selectedCluster.k8s_version}</strong>
                </span>
              )}
              <span>
                API Server: <code className="text-primary-400 font-mono">{selectedCluster.api_server_url}</code>
              </span>
              <button
                onClick={() => handleDeleteCluster(selectedCluster.id)}
                className="text-danger-400 hover:text-danger-300 flex items-center gap-1 transition-colors ml-2"
                title="Remove Cluster"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Offline Diagnostic Alert */}
        {selectedCluster && selectedCluster.last_status === 'unreachable' && (
          <div className="mt-4 p-3.5 bg-warning-500/10 border border-warning-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning-400 shrink-0 mt-0.5" />
            <div className="text-xs text-warning-200 space-y-1">
              <p className="font-semibold text-warning-300">
                Kubernetes API Server Unreachable ({selectedCluster.api_server_url})
              </p>
              <p className="text-dark-300">
                DevOpsPulse validates cluster metrics against the real Kubernetes API. To connect your cluster:
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-dark-400">
                <li>
                  <strong>Minikube / Kind:</strong> Run <code className="text-dark-200">minikube start</code> or <code className="text-dark-200">kubectl proxy --port=6443</code>.
                </li>
                <li>
                  <strong>EKS / GKE / AKS / Remote:</strong> Click &quot;Connect Cluster&quot;, enter your API server endpoint, and provide a ServiceAccount bearer token with cluster-reader permissions.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Scorecard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">Nodes (Ready / Total)</p>
            <p className="text-2xl font-bold text-dark-100 mt-1">
              {overview?.nodes_ready || 0} / {overview?.nodes_total || 0}
            </p>
          </div>
          <Server className="h-8 w-8 text-primary-400/50" />
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">Running Pods</p>
            <p className="text-2xl font-bold text-success-400 mt-1">{overview?.pods_running || 0}</p>
          </div>
          <CheckCircle2 className="h-8 w-8 text-success-400/50" />
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">Pending Pods</p>
            <p className="text-2xl font-bold text-warning-400 mt-1">{overview?.pods_pending || 0}</p>
          </div>
          <Clock className="h-8 w-8 text-warning-400/50" />
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">CrashLoop / Issues</p>
            <p className={`text-2xl font-bold mt-1 ${(overview?.crash_loop_count || 0) > 0 ? 'text-danger-400' : 'text-dark-300'}`}>
              {overview?.crash_loop_count || 0}
            </p>
          </div>
          <AlertTriangle className={`h-8 w-8 ${(overview?.crash_loop_count || 0) > 0 ? 'text-danger-400 animate-pulse' : 'text-dark-500'}`} />
        </div>
      </div>

      {/* Navigation Tabs (Pods vs Nodes) */}
      <div className="flex border-b border-dark-800 gap-6">
        <button
          onClick={() => setActiveTab('pods')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'pods'
              ? 'border-primary-500 text-primary-400 font-semibold'
              : 'border-transparent text-dark-400 hover:text-dark-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          Pods &amp; Workloads ({pods.length})
        </button>
        <button
          onClick={() => setActiveTab('nodes')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'nodes'
              ? 'border-primary-500 text-primary-400 font-semibold'
              : 'border-transparent text-dark-400 hover:text-dark-200'
          }`}
        >
          <Server className="h-4 w-4" />
          Nodes &amp; Capacity ({nodes.length})
        </button>
      </div>

      {/* Tab 1: Pods View */}
      {activeTab === 'pods' && (
        <div className="space-y-4">
          {/* Controls Bar: Namespace filter, search, status pills */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label htmlFor="k8s-namespace-filter" className="text-xs text-dark-400 font-medium">
                Namespace:
              </label>
              <select
                id="k8s-namespace-filter"
                aria-label="Filter by Namespace"
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                className="bg-white text-xs text-dark-100 rounded-xl border border-[#E5E7EB] px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 shadow-sm"
              >
                <option value="all">All Namespaces</option>
                {overview?.namespaces.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </select>

              <div className="relative flex-1 sm:w-60">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-dark-400" />
                <input
                  type="text"
                  placeholder="Search pod name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-white border border-[#E5E7EB] rounded-xl text-xs text-dark-100 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 shadow-sm"
                />
              </div>
            </div>

            <div className="flex items-center bg-dark-900 p-1 rounded-lg border border-dark-800 self-stretch sm:self-auto">
              {(['all', 'running', 'pending', 'failed', 'crashloop'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPodStatusFilter(tab)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium capitalize transition-colors ${
                    podStatusFilter === tab
                      ? 'bg-primary-600 text-white'
                      : 'text-dark-400 hover:text-dark-200'
                  }`}
                >
                  {tab === 'crashloop' ? 'CrashLoop / OOM' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Pods Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredPods.length === 0 ? (
            <div className="glass-card text-center py-12">
              <Boxes className="h-12 w-12 text-dark-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-dark-100">No pods found</h3>
              <p className="text-sm text-dark-400 mt-1">
                {pods.length === 0
                  ? 'No active pods discovered on this cluster or namespace.'
                  : 'No pods match your search or filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredPods.map((pod) => {
                const isRunning = pod.phase === 'Running';
                const hasCrash = pod.is_crash_loop || pod.is_oom_killed;

                return (
                  <div
                    key={`${pod.namespace}-${pod.name}`}
                    className={`glass-card p-5 hover:border-dark-600 transition-all flex flex-col justify-between ${
                      hasCrash ? 'border-danger-500/40 bg-danger-500/5' : ''
                    }`}
                  >
                    <div>
                      {/* Pod Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-dark-100 truncate" title={pod.name}>
                            {pod.name}
                          </h4>
                          <span className="text-[11px] bg-dark-900 text-primary-300 px-2 py-0.5 rounded font-mono border border-dark-700 mt-1 inline-block">
                            ns: {pod.namespace}
                          </span>
                        </div>

                        <Badge
                          variant={
                            isRunning
                              ? 'success'
                              : pod.phase === 'Pending'
                              ? 'warning'
                              : 'danger'
                          }
                          dot
                        >
                          {pod.phase}
                        </Badge>
                      </div>

                      {/* Failure / Crash Alert */}
                      {hasCrash && (
                        <div className="mt-3 p-2.5 bg-danger-500/10 border border-danger-500/20 rounded-md text-xs text-danger-300 flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-danger-400" />
                          <span>
                            {pod.is_crash_loop
                              ? 'CrashLoopBackOff detected'
                              : 'OOMKilled detected'}
                          </span>
                        </div>
                      )}

                      {/* Containers & Restarts */}
                      <div className="mt-3.5 pt-3 border-t border-dark-800 space-y-1.5 text-xs text-dark-300">
                        <div className="flex justify-between">
                          <span className="text-dark-400">Restarts:</span>
                          <span className={`font-mono font-medium ${pod.restarts_total > 5 ? 'text-danger-400' : 'text-dark-200'}`}>
                            {pod.restarts_total} times
                          </span>
                        </div>
                        {pod.node_name && (
                          <div className="flex justify-between">
                            <span className="text-dark-400">Node:</span>
                            <span className="font-mono text-dark-200 truncate max-w-[160px]" title={pod.node_name}>
                              {pod.node_name}
                            </span>
                          </div>
                        )}
                        {pod.pod_ip && (
                          <div className="flex justify-between">
                            <span className="text-dark-400">Pod IP:</span>
                            <span className="font-mono text-dark-200">{pod.pod_ip}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-dark-800 flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openPodLogs(pod)}
                        className="text-dark-300 hover:text-white"
                      >
                        <Terminal className="h-3.5 w-3.5 mr-1" />
                        Pod Logs
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Nodes View */}
      {activeTab === 'nodes' && (
        <div className="space-y-4">
          {nodes.length === 0 ? (
            <div className="glass-card text-center py-12">
              <Server className="h-12 w-12 text-dark-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-dark-100">No nodes discovered</h3>
              <p className="text-sm text-dark-400 mt-1">
                Unable to query cluster nodes. Ensure API server is reachable with appropriate RBAC permissions.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {nodes.map((node) => {
                const isReady = node.status === 'Ready';

                return (
                  <div key={node.name} className="glass-card p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-dark-100 truncate" title={node.name}>
                          {node.name}
                        </h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {node.roles.map((r) => (
                            <span key={r} className="text-[10px] bg-dark-900 text-primary-300 font-mono px-1.5 py-0.5 rounded border border-dark-700">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Badge variant={isReady ? 'success' : 'danger'} dot>
                        {node.status}
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-dark-800 space-y-2 text-xs text-dark-300">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-dark-400">
                          <Cpu className="h-3.5 w-3.5 text-primary-400" /> CPU Capacity:
                        </span>
                        <span className="font-mono text-dark-200">{node.cpu_capacity} cores</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-dark-400">
                          <Database className="h-3.5 w-3.5 text-purple-400" /> Memory:
                        </span>
                        <span className="font-mono text-dark-200">{node.memory_capacity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-400">Kubelet:</span>
                        <span className="font-mono text-dark-200">{node.kubelet_version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-400">OS / Arch:</span>
                        <span className="font-mono text-dark-200">{node.architecture}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Cluster Modal */}
      <Modal
        isOpen={isAddClusterOpen}
        onClose={() => setIsAddClusterOpen(false)}
        title="Connect Kubernetes Cluster"
      >
        <form onSubmit={handleAddCluster} className="space-y-4">
          <p className="text-xs text-dark-400">
            Register a Kubernetes API server endpoint to monitor nodes, pods, and deployments.
          </p>

          {addClusterError && (
            <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg text-xs text-danger-400">
              {addClusterError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">Cluster Name</label>
            <Input
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              placeholder="e.g. EKS Production / Minikube Local"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">API Server URL</label>
            <Input
              value={apiServerUrl}
              onChange={(e) => setApiServerUrl(e.target.value)}
              placeholder="https://127.0.0.1:6443 or https://k8s.company.com:6443"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">
              Bearer Token (ServiceAccount Token)
            </label>
            <textarea
              value={bearerToken}
              onChange={(e) => setBearerToken(e.target.value)}
              placeholder="Paste ServiceAccount JWT or cluster token (optional for local unauthenticated clusters)..."
              rows={3}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg text-xs text-white p-2.5 font-mono focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">Default Namespace Filter</label>
            <Input
              value={namespaceFilter}
              onChange={(e) => setNamespaceFilter(e.target.value)}
              placeholder="all, default, production..."
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="k8s-tls-toggle"
              checked={tlsVerify}
              onChange={(e) => setTlsVerify(e.target.checked)}
              className="rounded bg-dark-900 border-dark-700 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="k8s-tls-toggle" className="text-xs text-dark-300">
              Verify API-Server TLS Certificate
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddClusterOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={addClusterLoading}>
              Connect Cluster
            </Button>
          </div>
        </form>
      </Modal>

      {/* Terminal Pod Logs Modal */}
      <Modal
        isOpen={!!activeLogPod}
        onClose={() => setActiveLogPod(null)}
        title={`Pod Logs: ${activeLogPod?.name || ''}`}
        size="lg"
      >
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-dark-800">
            <div className="flex items-center gap-2">
              <select
                aria-label="Tail lines"
                value={logsTail}
                onChange={(e) => setLogsTail(Number(e.target.value))}
                className="bg-dark-900 text-xs text-dark-300 rounded border border-dark-700 px-2 py-1"
              >
                <option value={50}>Last 50 lines</option>
                <option value={100}>Last 100 lines</option>
                <option value={200}>Last 200 lines</option>
                <option value={500}>Last 500 lines</option>
              </select>

              <Button
                variant="secondary"
                size="sm"
                onClick={refreshPodLogs}
                isLoading={logsLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${logsLoading ? 'animate-spin' : ''}`} />
                Reload
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="bg-dark-900 text-xs text-white rounded border border-dark-700 px-2 py-1 w-36 placeholder-dark-500"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyLogs}
              >
                {copiedLog ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-success-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Terminal Console View */}
          <div className="bg-black/90 text-dark-200 font-mono text-xs rounded-lg p-3.5 h-96 overflow-y-auto border border-dark-800 leading-relaxed">
            {logsLoading && podLogs.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <LoadingSpinner size="md" />
              </div>
            ) : podLogs.length === 0 ? (
              <p className="text-dark-500 text-center py-10">No log output produced by pod.</p>
            ) : (
              podLogs
                .filter((line) => !logSearch || line.toLowerCase().includes(logSearch.toLowerCase()))
                .map((line, idx) => (
                  <div key={idx} className="hover:bg-dark-900/60 px-1 rounded flex gap-2">
                    <span className="text-dark-600 select-none w-8 text-right shrink-0">
                      {idx + 1}
                    </span>
                    <span className="break-all whitespace-pre-wrap">{line}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
