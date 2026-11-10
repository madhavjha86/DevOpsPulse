import React, { useEffect, useState, useMemo } from 'react';
import {
  Server,
  Play,
  Square,
  RotateCw,
  Terminal,
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Search,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  Database,
  Layers,
  Clock,
} from 'lucide-react';
import {
  dockerService,
  DockerHost,
  DockerContainer,
} from '../services/docker';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function DockerContainersPage() {
  const [hosts, setHosts] = useState<DockerHost[]>([]);
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'exited' | 'paused'>('all');

  // Add Host Modal
  const [isAddHostOpen, setIsAddHostOpen] = useState(false);
  const [newHostName, setNewHostName] = useState('');
  const [newHostUrl, setNewHostUrl] = useState('http://localhost:2375');
  const [newHostTls, setNewHostTls] = useState(false);
  const [addHostLoading, setAddHostLoading] = useState(false);
  const [addHostError, setAddHostError] = useState('');

  // Logs Modal
  const [activeLogContainer, setActiveLogContainer] = useState<DockerContainer | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsTail, setLogsTail] = useState(100);
  const [logSearch, setLogSearch] = useState('');
  const [copiedLog, setCopiedLog] = useState(false);

  const selectedHost = useMemo(
    () => hosts.find((h) => h.id === selectedHostId) || null,
    [hosts, selectedHostId]
  );

  const fetchHosts = async () => {
    try {
      const data = await dockerService.getHosts();
      setHosts(data);
      if (data.length > 0 && !selectedHostId) {
        setSelectedHostId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load Docker hosts', err);
    }
  };

  const fetchContainers = async (hostId: number) => {
    try {
      setRefreshing(true);
      const res = await dockerService.getContainers(hostId);
      setContainers(res.containers || []);
      setHosts((prev) =>
        prev.map((h) =>
          h.id === hostId
            ? {
                ...h,
                last_status: res.host_status as DockerHost['last_status'],
                containers_count: res.total_containers,
              }
            : h
        )
      );
    } catch (err) {
      console.error('Failed to load containers', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHosts();
  }, []);

  useEffect(() => {
    if (selectedHostId) {
      fetchContainers(selectedHostId);
    }
  }, [selectedHostId]);

  const handleAddHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostName.trim() || !newHostUrl.trim()) return;

    setAddHostLoading(true);
    setAddHostError('');
    try {
      const created = await dockerService.createHost({
        name: newHostName.trim(),
        host_url: newHostUrl.trim(),
        tls_verify: newHostTls,
      });
      setHosts((prev) => [created, ...prev]);
      setSelectedHostId(created.id);
      setIsAddHostOpen(false);
      setNewHostName('');
      setNewHostUrl('http://localhost:2375');
      setNewHostTls(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register Docker host';
      setAddHostError(msg);
    } finally {
      setAddHostLoading(false);
    }
  };

  const handleDeleteHost = async (hostId: number) => {
    if (!window.confirm('Are you sure you want to remove this Docker host endpoint?')) return;
    try {
      await dockerService.deleteHost(hostId);
      setHosts((prev) => prev.filter((h) => h.id !== hostId));
      if (selectedHostId === hostId) {
        const remaining = hosts.filter((h) => h.id !== hostId);
        setSelectedHostId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete host', err);
    }
  };

  const handleContainerAction = async (
    containerId: string,
    action: 'start' | 'stop' | 'restart'
  ) => {
    if (!selectedHostId) return;
    setActionLoadingId(`${containerId}-${action}`);
    try {
      const res = await dockerService.executeAction(selectedHostId, containerId, action);
      if (res.success && res.new_state) {
        setContainers((prev) =>
          prev.map((c) =>
            c.id === containerId
              ? {
                  ...c,
                  state: res.new_state!,
                  status: `${res.new_state} just now`,
                }
              : c
          )
        );
      }
      setTimeout(() => {
        if (selectedHostId) fetchContainers(selectedHostId);
      }, 1000);
    } catch (err) {
      console.error(`Failed to ${action} container`, err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const openLogsModal = async (container: DockerContainer) => {
    if (!selectedHostId) return;
    setActiveLogContainer(container);
    setLogs([]);
    setLogsLoading(true);
    try {
      const res = await dockerService.getLogs(selectedHostId, container.id, logsTail);
      setLogs(res.lines || []);
    } catch (err) {
      setLogs([`Failed to fetch logs: ${err}`]);
    } finally {
      setLogsLoading(false);
    }
  };

  const refreshActiveLogs = async () => {
    if (!selectedHostId || !activeLogContainer) return;
    setLogsLoading(true);
    try {
      const res = await dockerService.getLogs(selectedHostId, activeLogContainer.id, logsTail);
      setLogs(res.lines || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const filteredContainers = useMemo(() => {
    return containers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.image.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'running'
          ? c.state === 'running'
          : statusFilter === 'exited'
          ? c.state === 'exited'
          : c.state === 'paused';
      return matchesSearch && matchesStatus;
    });
  }, [containers, searchQuery, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: containers.length,
      running: containers.filter((c) => c.state === 'running').length,
      stopped: containers.filter((c) => c.state === 'exited').length,
      paused: containers.filter((c) => c.state === 'paused').length,
    };
  }, [containers]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-2">
            <Server className="h-7 w-7 text-primary-500" />
            Docker Container Monitoring
          </h1>
          <p className="text-sm text-dark-400 mt-1">
            Real-time container inspection, live CPU/memory telemetry, terminal logs, and runtime controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => selectedHostId && fetchContainers(selectedHostId)}
            isLoading={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddHostOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Connect Host
          </Button>
        </div>
      </div>

      {/* Host Control & Health Bar */}
      <div className="glass-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label htmlFor="host-selector" className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
              Docker Host:
            </label>
            <select
              id="host-selector"
              aria-label="Select Docker Host"
              value={selectedHostId || ''}
              onChange={(e) => setSelectedHostId(Number(e.target.value))}
              className="bg-white text-dark-100 text-sm rounded-xl border border-[#E5E7EB] px-3 py-1.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 shadow-sm"
            >
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.host_url})
                </option>
              ))}
            </select>

            {selectedHost && (
              <Badge
                variant={
                  selectedHost.last_status === 'connected'
                    ? 'success'
                    : selectedHost.last_status === 'unreachable'
                    ? 'warning'
                    : 'danger'
                }
                dot
              >
                {selectedHost.last_status.toUpperCase()}
              </Badge>
            )}
          </div>

          {selectedHost && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-dark-400">
              {selectedHost.server_version && (
                <span>
                  Engine: <strong className="text-dark-200">{selectedHost.server_version}</strong>
                </span>
              )}
              <span>
                Endpoint: <code className="text-primary-400 font-mono">{selectedHost.host_url}</code>
              </span>
              <button
                onClick={() => handleDeleteHost(selectedHost.id)}
                className="text-danger-400 hover:text-danger-300 flex items-center gap-1 transition-colors ml-2"
                title="Remove Host"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Diagnostic Offline Guidance if Unreachable */}
        {selectedHost && selectedHost.last_status === 'unreachable' && (
          <div className="mt-4 p-3.5 bg-warning-500/10 border border-warning-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning-400 shrink-0 mt-0.5" />
            <div className="text-xs text-warning-200 space-y-1">
              <p className="font-semibold text-warning-300">
                Docker Daemon Connection Unreachable ({selectedHost.host_url})
              </p>
              <p className="text-dark-300">
                DevOpsPulse communicates with Docker Engine using the real Docker API. If you are running locally:
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-dark-400">
                <li>
                  <strong>Windows / Docker Desktop:</strong> In Settings &gt; General, check{' '}
                  <em>&quot;Expose daemon on tcp://localhost:2375 without TLS&quot;</em>.
                </li>
                <li>
                  <strong>Linux / macOS:</strong> Ensure Docker is running and your user has permissions to{' '}
                  <code className="text-dark-200">/var/run/docker.sock</code>.
                </li>
                <li>
                  <strong>Remote Server:</strong> Click &quot;Connect Host&quot; and provide the remote server URL (e.g. <code className="text-dark-200">http://192.168.1.50:2375</code>).
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">Total Containers</p>
            <p className="text-2xl font-bold text-dark-100 mt-1">{counts.total}</p>
          </div>
          <Layers className="h-8 w-8 text-primary-400/50" />
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">Running</p>
            <p className="text-2xl font-bold text-success-400 mt-1">{counts.running}</p>
          </div>
          <CheckCircle2 className="h-8 w-8 text-success-400/50" />
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">Stopped / Exited</p>
            <p className="text-2xl font-bold text-danger-400 mt-1">{counts.stopped}</p>
          </div>
          <XCircle className="h-8 w-8 text-danger-400/50" />
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">Paused</p>
            <p className="text-2xl font-bold text-warning-400 mt-1">{counts.paused}</p>
          </div>
          <Activity className="h-8 w-8 text-warning-400/50" />
        </div>
      </div>

      {/* Search and Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-dark-400" />
          <input
            type="text"
            placeholder="Search container or image..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#E5E7EB] rounded-xl text-sm text-dark-100 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 shadow-sm"
          />
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-[#E5E7EB] self-stretch sm:self-auto">
          {(['all', 'running', 'exited', 'paused'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 text-xs rounded-lg font-semibold capitalize transition-all duration-150 ${
                statusFilter === tab
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-dark-400 hover:text-dark-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Containers List */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredContainers.length === 0 ? (
        <div className="glass-card text-center py-12">
          <Server className="h-12 w-12 text-dark-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-dark-100">No containers found</h3>
          <p className="text-sm text-dark-400 mt-1">
            {containers.length === 0
              ? 'No active containers discovered on this Docker host.'
              : 'No containers match your search or filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredContainers.map((container) => {
            const isRunning = container.state === 'running';
            const isStarting = actionLoadingId === `${container.id}-start`;
            const isStopping = actionLoadingId === `${container.id}-stop`;
            const isRestarting = actionLoadingId === `${container.id}-restart`;

            return (
              <div
                key={container.id}
                className="glass-card p-5 hover:border-dark-600 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Container Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            isRunning
                              ? 'bg-success-400 ring-4 ring-success-400/20'
                              : container.state === 'paused'
                              ? 'bg-warning-400'
                              : 'bg-danger-400'
                          }`}
                        />
                        <h4 className="text-sm font-bold text-dark-100 truncate" title={container.name}>
                          {container.name}
                        </h4>
                      </div>
                      <p className="text-xs text-dark-400 font-mono mt-0.5 truncate" title={container.image}>
                        {container.image}
                      </p>
                    </div>

                    <Badge
                      variant={
                        isRunning ? 'success' : container.state === 'paused' ? 'warning' : 'neutral'
                      }
                    >
                      {container.state}
                    </Badge>
                  </div>

                  {/* Status & Uptime */}
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-dark-400">
                    <Clock className="h-3.5 w-3.5 text-dark-500" />
                    <span>{container.status}</span>
                  </div>

                  {/* Live Resource Telemetry (CPU & Memory) */}
                  {container.stats && (
                    <div className="mt-3.5 pt-3 border-t border-dark-800 space-y-2">
                      <div>
                        <div className="flex justify-between text-xs text-dark-400 mb-1">
                          <span className="flex items-center gap-1">
                            <Cpu className="h-3 w-3 text-primary-400" /> CPU
                          </span>
                          <span className="font-mono text-dark-200">
                            {container.stats.cpu_percent}%
                          </span>
                        </div>
                        <div className="w-full bg-dark-900 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-primary-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(container.stats.cpu_percent, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-dark-400 mb-1">
                          <span className="flex items-center gap-1">
                            <Database className="h-3 w-3 text-purple-400" /> Memory
                          </span>
                          <span className="font-mono text-dark-200">
                            {container.stats.memory_usage_mb} MB ({container.stats.memory_percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-dark-900 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(container.stats.memory_percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Port mappings */}
                  {container.ports.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {container.ports.map((p, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-dark-900/90 text-primary-300 font-mono px-2 py-0.5 rounded border border-dark-700"
                        >
                          {p.host_port ? `${p.host_port}:` : ''}
                          {p.container_port}/{p.protocol}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Operations Controls */}
                <div className="mt-4 pt-3 border-t border-dark-800 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {isRunning ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleContainerAction(container.id, 'stop')}
                        isLoading={isStopping}
                        title="Stop Container"
                        className="text-danger-400 hover:text-danger-300"
                      >
                        <Square className="h-3.5 w-3.5 mr-1" />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleContainerAction(container.id, 'start')}
                        isLoading={isStarting}
                        title="Start Container"
                        className="text-success-400 hover:text-success-300"
                      >
                        <Play className="h-3.5 w-3.5 mr-1" />
                        Start
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleContainerAction(container.id, 'restart')}
                      isLoading={isRestarting}
                      title="Restart Container"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openLogsModal(container)}
                    className="text-dark-300 hover:text-white"
                  >
                    <Terminal className="h-3.5 w-3.5 mr-1" />
                    Logs
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Docker Host Modal */}
      <Modal
        isOpen={isAddHostOpen}
        onClose={() => setIsAddHostOpen(false)}
        title="Connect Docker Host"
      >
        <form onSubmit={handleAddHost} className="space-y-4">
          <p className="text-xs text-dark-400">
            Register a local or remote Docker daemon socket endpoint to stream telemetry and container controls.
          </p>

          {addHostError && (
            <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg text-xs text-danger-400">
              {addHostError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">Host Name</label>
            <Input
              value={newHostName}
              onChange={(e) => setNewHostName(e.target.value)}
              placeholder="e.g. Staging Server / Local Daemon"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">
              Daemon Endpoint URL
            </label>
            <Input
              value={newHostUrl}
              onChange={(e) => setNewHostUrl(e.target.value)}
              placeholder="http://localhost:2375 or tcp://192.168.1.50:2375"
              required
            />
            <p className="text-[11px] text-dark-500 mt-1">
              Supports standard Docker REST endpoints: HTTP, TCP, or Unix socket (unix:///var/run/docker.sock).
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="tls-toggle"
              checked={newHostTls}
              onChange={(e) => setNewHostTls(e.target.checked)}
              className="rounded bg-dark-900 border-dark-700 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="tls-toggle" className="text-xs text-dark-300">
              Enable TLS Verification (HTTPS)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddHostOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={addHostLoading}>
              Connect Endpoint
            </Button>
          </div>
        </form>
      </Modal>

      {/* Terminal Container Logs Modal */}
      <Modal
        isOpen={!!activeLogContainer}
        onClose={() => setActiveLogContainer(null)}
        title={`Container Logs: ${activeLogContainer?.name || ''}`}
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
                onClick={refreshActiveLogs}
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
            {logsLoading && logs.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <LoadingSpinner size="md" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-dark-500 text-center py-10">No log output produced by container.</p>
            ) : (
              logs
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
