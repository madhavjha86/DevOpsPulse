import React, { useEffect, useState, useMemo } from 'react';
import {
  Cloud,
  Plus,
  RefreshCw,
  Search,
  Server,
  Database,
  Zap,
  DollarSign,
  AlertCircle,
  Trash2,
  Cpu,
  Activity,
  Layers,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  cloudService,
  CloudAccount,
  CloudOverview,
  CloudMetrics,
  CloudProvider,
} from '../services/cloud';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function CloudMonitoringPage() {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [overview, setOverview] = useState<CloudOverview | null>(null);
  const [metrics, setMetrics] = useState<CloudMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [providerFilter, setProviderFilter] = useState<'all' | CloudProvider>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');

  // Add Account Modal
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [modalProvider, setModalProvider] = useState<CloudProvider>('aws');
  const [accountName, setAccountName] = useState('');
  const [region, setRegion] = useState('us-east-1');
  // AWS
  const [awsKeyId, setAwsKeyId] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  // Azure
  const [azureSubId, setAzureSubId] = useState('');
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  // GCP
  const [gcpProjectId, setGcpProjectId] = useState('');
  const [gcpSaJson, setGcpSaJson] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );

  const fetchAccounts = async () => {
    try {
      const data = await cloudService.getAccounts();
      setAccounts(data);
      if (data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load cloud accounts', err);
    }
  };

  const fetchAccountData = async (accountId: number) => {
    try {
      setRefreshing(true);
      const [ovData, mData] = await Promise.all([
        cloudService.getOverview(accountId),
        cloudService.getMetrics(accountId),
      ]);
      setOverview(ovData);
      setMetrics(mData);
      // Update account in list
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? { ...a, last_status: ovData.status as CloudAccount['last_status'] }
            : a
        )
      );
    } catch (err) {
      console.error('Failed to load cloud account data', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchAccountData(selectedAccountId);
    }
  }, [selectedAccountId]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) return;

    setAddLoading(true);
    setAddError('');
    try {
      const created = await cloudService.createAccount({
        provider: modalProvider,
        name: accountName.trim(),
        region: region.trim(),
        aws_access_key_id: awsKeyId.trim() || undefined,
        aws_secret_access_key: awsSecretKey.trim() || undefined,
        azure_subscription_id: azureSubId.trim() || undefined,
        azure_tenant_id: azureTenantId.trim() || undefined,
        azure_client_id: azureClientId.trim() || undefined,
        azure_client_secret: azureClientSecret.trim() || undefined,
        gcp_project_id: gcpProjectId.trim() || undefined,
        gcp_service_account_json: gcpSaJson.trim() || undefined,
      });
      setAccounts((prev) => [created, ...prev]);
      setSelectedAccountId(created.id);
      setIsAddAccountOpen(false);
      setAccountName('');
      setAwsKeyId('');
      setAwsSecretKey('');
      setAzureSubId('');
      setAzureTenantId('');
      setAzureClientId('');
      setAzureClientSecret('');
      setGcpProjectId('');
      setGcpSaJson('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register cloud account';
      setAddError(msg);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: number) => {
    if (!window.confirm('Are you sure you want to remove this cloud provider account?')) return;
    try {
      await cloudService.deleteAccount(accountId);
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      if (selectedAccountId === accountId) {
        const remaining = accounts.filter((a) => a.id !== accountId);
        setSelectedAccountId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete cloud account', err);
    }
  };

  const chartData = useMemo(() => {
    if (!metrics) return [];
    return metrics.timestamps.map((ts, idx) => ({
      time: ts,
      cpu: metrics.cpu_utilization[idx] || 0,
      network: metrics.network_io_mb[idx] || 0,
    }));
  }, [metrics]);

  const filteredResources = useMemo(() => {
    if (!overview) return [];
    return overview.resources.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.spec.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        resourceTypeFilter === 'all'
          ? true
          : r.type.toLowerCase().includes(resourceTypeFilter.toLowerCase());
      return matchesSearch && matchesType;
    });
  }, [overview, searchQuery, resourceTypeFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cloud className="h-7 w-7 text-primary-500" />
            Cloud Infrastructure Monitoring
          </h1>
          <p className="text-sm text-dark-400 mt-1">
            Real-time multi-cloud telemetry across AWS CloudWatch, Azure Monitor, and Google Cloud Monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => selectedAccountId && fetchAccountData(selectedAccountId)}
            isLoading={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddAccountOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Connect Account
          </Button>
        </div>
      </div>

      {/* Account Control & Health Bar */}
      <div className="glass-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label htmlFor="cloud-account-selector" className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
              Account:
            </label>
            <select
              id="cloud-account-selector"
              aria-label="Select Cloud Account"
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              className="bg-dark-900 text-white text-sm rounded-lg border border-dark-700 px-3 py-1.5 focus:ring-primary-500 focus:border-primary-500"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.provider.toUpperCase()}] {a.name} ({a.region})
                </option>
              ))}
            </select>

            {selectedAccount && (
              <Badge
                variant={
                  selectedAccount.last_status === 'connected'
                    ? 'success'
                    : selectedAccount.last_status === 'unconfigured'
                    ? 'warning'
                    : 'danger'
                }
                dot
              >
                {selectedAccount.last_status.toUpperCase()}
              </Badge>
            )}
          </div>

          {selectedAccount && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-dark-400">
              <span>
                Provider: <strong className="text-dark-200 uppercase">{selectedAccount.provider}</strong>
              </span>
              <span>
                Identifier: <code className="text-primary-400 font-mono">{selectedAccount.masked_identifier}</code>
              </span>
              <span>
                Region: <strong className="text-dark-200 font-mono">{selectedAccount.region}</strong>
              </span>
              <button
                onClick={() => handleDeleteAccount(selectedAccount.id)}
                className="text-danger-400 hover:text-danger-300 flex items-center gap-1 transition-colors ml-2"
                title="Remove Account"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Unconfigured / Credential Diagnostic Alert */}
        {selectedAccount && selectedAccount.last_status === 'unconfigured' && (
          <div className="mt-4 p-3.5 bg-warning-500/10 border border-warning-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning-400 shrink-0 mt-0.5" />
            <div className="text-xs text-warning-200 space-y-1">
              <p className="font-semibold text-warning-300">
                Cloud Provider Credentials Unconfigured ({selectedAccount.provider.toUpperCase()})
              </p>
              <p className="text-dark-300">
                DevOpsPulse communicates with official Cloud APIs and stores credentials encrypted with AES-Fernet at rest.
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-dark-400">
                {selectedAccount.provider === 'aws' && (
                  <li>
                    <strong>AWS CloudWatch:</strong> Provide IAM credentials with the <code className="text-dark-200">CloudWatchReadOnlyAccess</code> and <code className="text-dark-200">AmazonEC2ReadOnlyAccess</code> policies.
                  </li>
                )}
                {selectedAccount.provider === 'azure' && (
                  <li>
                    <strong>Azure Monitor:</strong> Register an App Registration with Service Principal and grant the <code className="text-dark-200">Monitoring Reader</code> role.
                  </li>
                )}
                {selectedAccount.provider === 'gcp' && (
                  <li>
                    <strong>GCP Monitoring:</strong> Create a Service Account with the <code className="text-dark-200">roles/monitoring.viewer</code> role and upload the JSON key.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Scorecard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">Virtual Machines</p>
            <p className="text-2xl font-bold text-white mt-1">
              {overview?.running_vms || 0} <span className="text-sm font-normal text-dark-400">/ {overview?.total_vms || 0}</span>
            </p>
          </div>
          <Server className="h-8 w-8 text-primary-400/50" />
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">Cloud Databases</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">{overview?.total_databases || 0}</p>
          </div>
          <Database className="h-8 w-8 text-purple-400/50" />
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">Serverless Functions</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{overview?.total_serverless || 0}</p>
          </div>
          <Zap className="h-8 w-8 text-amber-400/50" />
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-dark-400 font-medium">Monthly Est. Cost</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              ${overview?.estimated_monthly_cost.toFixed(2) || '0.00'}
            </p>
          </div>
          <DollarSign className="h-8 w-8 text-emerald-400/50" />
        </div>
      </div>

      {/* 24-Hour Telemetry Graphs */}
      {chartData.length > 0 && selectedAccount?.last_status === 'connected' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary-400" />
                Aggregated CPU Utilization (24h)
              </h3>
              <span className="text-xs text-dark-400 font-mono">CloudWatch / Monitor</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="time" stroke="#737373" fontSize={11} />
                  <YAxis stroke="#737373" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', fontSize: '12px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    name="CPU %"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Network I/O Throughput (MB)
              </h3>
              <span className="text-xs text-dark-400 font-mono">Network In/Out</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="time" stroke="#737373" fontSize={11} />
                  <YAxis stroke="#737373" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', fontSize: '12px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="network"
                    name="Network MB"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Discovered Resources Inventory */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-dark-400" />
            <input
              type="text"
              placeholder="Search resource name or spec..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-dark-900 border border-dark-700 rounded-lg text-sm text-white placeholder-dark-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center bg-dark-900 p-1 rounded-lg border border-dark-800 self-stretch sm:self-auto">
            {(['all', 'instance', 'database', 'lambda'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setResourceTypeFilter(tab)}
                className={`px-3 py-1 text-xs rounded-md font-medium capitalize transition-colors ${
                  resourceTypeFilter === tab
                    ? 'bg-primary-600 text-white'
                    : 'text-dark-400 hover:text-dark-200'
                }`}
              >
                {tab === 'instance' ? 'Compute / VMs' : tab === 'lambda' ? 'Serverless' : tab}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="glass-card text-center py-12">
            <Layers className="h-12 w-12 text-dark-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No cloud resources found</h3>
            <p className="text-sm text-dark-400 mt-1">
              {overview?.resources.length === 0
                ? 'No active cloud resources discovered on this account.'
                : 'No resources match your search or filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredResources.map((res) => (
              <div
                key={res.id}
                className="glass-card p-5 hover:border-dark-600 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate" title={res.name}>
                        {res.name}
                      </h4>
                      <p className="text-xs text-dark-400 font-mono mt-0.5 truncate" title={res.id}>
                        {res.id}
                      </p>
                    </div>

                    <Badge
                      variant={
                        res.status === 'running' || res.status === 'available'
                          ? 'success'
                          : 'neutral'
                      }
                      dot
                    >
                      {res.status}
                    </Badge>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-dark-800 space-y-1.5 text-xs text-dark-300">
                    <div className="flex justify-between">
                      <span className="text-dark-400">Type:</span>
                      <span className="font-mono text-primary-300">{res.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dark-400">Spec:</span>
                      <span className="font-mono text-dark-200 truncate max-w-[180px]" title={res.spec}>
                        {res.spec}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dark-400">Region:</span>
                      <span className="font-mono text-dark-200">{res.region}</span>
                    </div>
                  </div>

                  {res.metrics && Object.keys(res.metrics).length > 0 && (
                    <div className="mt-3 pt-2 border-t border-dark-800 flex flex-wrap gap-2">
                      {Object.entries(res.metrics).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-[10px] bg-dark-900 text-emerald-300 font-mono px-2 py-0.5 rounded border border-dark-700"
                        >
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connect Cloud Account Modal */}
      <Modal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        title="Connect Cloud Provider Account"
      >
        <form onSubmit={handleAddAccount} className="space-y-4">
          <p className="text-xs text-dark-400">
            Connect AWS, Azure, or GCP credentials to stream infrastructure telemetry. All secrets are stored encrypted using AES-Fernet.
          </p>

          {addError && (
            <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg text-xs text-danger-400">
              {addError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {(['aws', 'azure', 'gcp'] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setModalProvider(p)}
                  className={`py-2 text-xs font-semibold rounded-lg border uppercase transition-colors ${
                    modalProvider === p
                      ? 'bg-primary-600 border-primary-500 text-white'
                      : 'bg-dark-900 border-dark-700 text-dark-300 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">Account Name</label>
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. AWS Production East"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">Default Region</label>
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. us-east-1, eastus, us-central1"
              required
            />
          </div>

          {/* Provider Specific Credential Inputs */}
          {modalProvider === 'aws' && (
            <div className="space-y-3 pt-2 border-t border-dark-800">
              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1">AWS Access Key ID</label>
                <Input
                  value={awsKeyId}
                  onChange={(e) => setAwsKeyId(e.target.value)}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1">AWS Secret Access Key</label>
                <Input
                  type="password"
                  value={awsSecretKey}
                  onChange={(e) => setAwsSecretKey(e.target.value)}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                />
              </div>
            </div>
          )}

          {modalProvider === 'azure' && (
            <div className="space-y-3 pt-2 border-t border-dark-800">
              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1">Subscription ID</label>
                <Input
                  value={azureSubId}
                  onChange={(e) => setAzureSubId(e.target.value)}
                  placeholder="UUID (e.g. 12345678-1234-...)"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1">Tenant ID</label>
                <Input
                  value={azureTenantId}
                  onChange={(e) => setAzureTenantId(e.target.value)}
                  placeholder="Directory (tenant) ID"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1">Client ID</label>
                <Input
                  value={azureClientId}
                  onChange={(e) => setAzureClientId(e.target.value)}
                  placeholder="Application (client) ID"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1">Client Secret</label>
                <Input
                  type="password"
                  value={azureClientSecret}
                  onChange={(e) => setAzureClientSecret(e.target.value)}
                  placeholder="Azure Secret Value"
                />
              </div>
            </div>
          )}

          {modalProvider === 'gcp' && (
            <div className="space-y-3 pt-2 border-t border-dark-800">
              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1">GCP Project ID</label>
                <Input
                  value={gcpProjectId}
                  onChange={(e) => setGcpProjectId(e.target.value)}
                  placeholder="e.g. pulse-production-1928"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1">Service Account Key JSON</label>
                <textarea
                  value={gcpSaJson}
                  onChange={(e) => setGcpSaJson(e.target.value)}
                  placeholder='{"type": "service_account", "project_id": "...", ...}'
                  rows={3}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg text-xs text-white p-2.5 font-mono focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddAccountOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={addLoading}>
              Connect Provider
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
