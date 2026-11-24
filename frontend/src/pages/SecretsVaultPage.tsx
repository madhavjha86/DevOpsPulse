import React, { useEffect, useState } from 'react';
import {
  Lock,
  Key,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldAlert,
  Terminal,
} from 'lucide-react';
import {
  secretsVaultApi,
  SecretItem,
  SecretCreateRequest,
  SecretLeakScanResult,
  SecretSyncK8sResponse,
} from '../services/secretsVault';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function SecretsVaultPage() {
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [environment, setEnvironment] = useState<'production' | 'staging' | 'development'>('production');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Add Secret Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<'API_KEY' | 'DATABASE_URL' | 'SSH_KEY' | 'CERTIFICATE' | 'OAUTH_TOKEN'>('API_KEY');
  const [addLoading, setAddLoading] = useState(false);

  // Leak Scanner
  const [scanResult, setScanResult] = useState<SecretLeakScanResult | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'vault' | 'scanner'>('vault');

  // K8s Sync
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<SecretSyncK8sResponse | null>(null);

  useEffect(() => {
    void loadSecrets();
  }, [environment]);

  const loadSecrets = async () => {
    try {
      setLoading(true);
      const data = await secretsVaultApi.listSecrets(environment);
      setSecrets(data);
    } catch (err) {
      console.error('Failed to load secrets', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = async (secretId: string) => {
    if (revealedSecrets[secretId]) {
      const next = { ...revealedSecrets };
      delete next[secretId];
      setRevealedSecrets(next);
      return;
    }
    try {
      setRevealingId(secretId);
      const res = await secretsVaultApi.revealSecret(secretId);
      setRevealedSecrets((prev) => ({ ...prev, [secretId]: res.value }));
    } catch (err) {
      console.error('Failed to reveal secret', err);
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopy = (key: string, val: string) => {
    void navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    try {
      setAddLoading(true);
      const created = await secretsVaultApi.createSecret({
        key: newKey.trim().toUpperCase(),
        value: newValue.trim(),
        environment,
        category: newCategory,
      });
      setSecrets([created, ...secrets]);
      setIsAddOpen(false);
      setNewKey('');
      setNewValue('');
    } catch (err) {
      console.error('Failed to add secret', err);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteSecret = async (secretId: string) => {
    if (!confirm('Are you sure you want to permanently delete this secret?')) return;
    try {
      await secretsVaultApi.deleteSecret(secretId);
      setSecrets(secrets.filter((s) => s.id !== secretId));
    } catch (err) {
      console.error('Failed to delete secret', err);
    }
  };

  const handleRunLeakScan = async () => {
    try {
      setScanLoading(true);
      const res = await secretsVaultApi.runLeakScan();
      setScanResult(res);
      setActiveTab('scanner');
    } catch (err) {
      console.error('Failed to run leak scan', err);
    } finally {
      setScanLoading(false);
    }
  };

  const handleSyncToK8s = async () => {
    try {
      setSyncLoading(true);
      const res = await secretsVaultApi.syncToK8s({
        environment,
        namespace: environment,
        secret_name: `app-secrets-${environment}`,
      });
      setSyncResult(res);
    } catch (err) {
      console.error('Failed to sync to Kubernetes', err);
    } finally {
      setSyncLoading(false);
    }
  };

  const filteredSecrets = secrets.filter((s) =>
    s.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shadow-sm">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Zero-Trust Secrets Vault
                </h1>
                <Badge variant="warning">AES-256 Encrypted</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Centralized multi-environment credentials manager, automated leak scanner, and 1-click Kubernetes Secret synchronizer.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="secondary" onClick={handleRunLeakScan} disabled={scanLoading}>
            {scanLoading ? <LoadingSpinner size="sm" /> : <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-amber-600" />}
            Scan for Leaks
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleSyncToK8s}
            disabled={syncLoading}
            className="text-emerald-700 hover:text-emerald-800"
          >
            {syncLoading ? <LoadingSpinner size="sm" /> : <Terminal className="mr-1.5 h-3.5 w-3.5" />}
            Sync to K8s Secret
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsAddOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Secret
          </Button>
        </div>
      </div>

      {syncResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-900 font-medium flex items-center justify-between shadow-subtle">
          <span>
            Injected <strong>{syncResult.injected_keys_count}</strong> secrets into Kubernetes Secret{' '}
            <code className="rounded bg-white px-2 py-0.5 border border-emerald-200 text-emerald-800 font-bold">{syncResult.k8s_secret_name}</code> (Namespace:{' '}
            {syncResult.namespace}) in {syncResult.duration_ms}ms.
          </span>
          <button onClick={() => setSyncResult(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex rounded-xl border border-slate-200 bg-slate-100/70 p-1">
          {(['production', 'staging', 'development'] as const).map((env) => (
            <button
              key={env}
              onClick={() => {
                setEnvironment(env);
                setActiveTab('vault');
              }}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold capitalize transition ${
                environment === env && activeTab === 'vault'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {env}
            </button>
          ))}
          <button
            onClick={() => {
              setActiveTab('scanner');
              if (!scanResult) void handleRunLeakScan();
            }}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition ${
              activeTab === 'scanner'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
            Leak Findings {scanResult ? `(${scanResult.detected_leaks_count})` : ''}
          </button>
        </div>

        {activeTab === 'vault' && (
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search secret key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 shadow-2xs focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        )}
      </div>

      {activeTab === 'vault' ? (
        /* Vault Table */
        <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-subtle overflow-hidden">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredSecrets.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Key className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No secrets found in {environment}</p>
              <p className="text-xs text-slate-400 mt-1">Click "New Secret" to create your first encrypted credential.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Secret Key</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Encrypted Value</th>
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4">Last Rotated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredSecrets.map((secret) => {
                    const isRevealed = Boolean(revealedSecrets[secret.id]);
                    const displayVal = isRevealed ? revealedSecrets[secret.id] : secret.value_masked;

                    return (
                      <tr key={secret.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Key className="h-3.5 w-3.5 text-amber-500" />
                            <span>{secret.key}</span>
                            {secret.is_leaked && (
                              <Badge variant="danger" className="text-[10px]">
                                Leaked In Code
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <Badge variant="neutral">{secret.category}</Badge>
                        </td>

                        <td className="py-3 px-4 font-mono text-xs text-slate-700">
                          <div className="flex items-center gap-2">
                            <span className={isRevealed ? 'text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200' : 'text-slate-500'}>
                              {displayVal}
                            </span>
                            <button
                              onClick={() => handleReveal(secret.id)}
                              disabled={revealingId === secret.id}
                              className="text-slate-400 hover:text-slate-700 transition"
                              title={isRevealed ? 'Hide secret' : 'Reveal secret'}
                            >
                              {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            {isRevealed && (
                              <button
                                onClick={() => handleCopy(secret.id, displayVal)}
                                className="text-slate-400 hover:text-emerald-600 transition"
                                title="Copy secret"
                              >
                                {copiedKey === secret.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-500 font-mono">v{secret.version}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {new Date(secret.last_rotated_at).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteSecret(secret.id)}
                            className="text-slate-400 hover:text-rose-600 transition p-1"
                            title="Delete secret"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Leak Scanner View */
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 space-y-4 shadow-subtle">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <span>Zero-Trust Secret Leak Scanner Results</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Scanned {scanResult?.scanned_files_count || 0} repository source files and git commits.
              </p>
            </div>

            <Button size="sm" variant="secondary" onClick={handleRunLeakScan} disabled={scanLoading}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Re-Scan
            </Button>
          </div>

          {scanResult?.findings && scanResult.findings.length > 0 ? (
            <div className="space-y-3">
              {scanResult.findings.map((finding, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800">
                      [{finding.severity.toUpperCase()}] {finding.secret_type}
                    </span>
                    <span className="text-[11px] font-mono font-medium text-slate-600">
                      {finding.file_path}:{finding.line_number}
                    </span>
                  </div>
                  <pre className="rounded-lg bg-white p-2.5 font-mono text-xs text-rose-800 border border-rose-200 shadow-inner">
                    {finding.snippet_masked}
                  </pre>
                  <p className="text-[11px] text-slate-600">
                    Remediation: Remove this hardcoded token from git history and inject it securely via the Zero-Trust Secrets Vault.
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">
              <Shield className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-800">Clean! No exposed secrets detected in codebase.</p>
            </div>
          )}
        </div>
      )}

      {/* Add Secret Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={`Create Secret (${environment})`}>
        <form onSubmit={handleAddSecret} className="space-y-4">
          <Input
            label="Secret Key (Uppercase SNAKE_CASE)"
            placeholder="e.g. STRIPE_API_KEY, DATABASE_PASSWORD"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            required
          />

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Secret Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-2xs focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="API_KEY">API Key</option>
              <option value="DATABASE_URL">Database Connection URL</option>
              <option value="SSH_KEY">SSH Private Key</option>
              <option value="CERTIFICATE">TLS Certificate</option>
              <option value="OAUTH_TOKEN">OAuth Token</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Secret Value (Raw Plaintext)</label>
            <textarea
              rows={3}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Paste raw sensitive value here..."
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 shadow-2xs focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={addLoading} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
              {addLoading ? <LoadingSpinner size="sm" /> : 'Save & Encrypt'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
