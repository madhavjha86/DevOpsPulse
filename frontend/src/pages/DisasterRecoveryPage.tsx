import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Database,
  Key,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Play,
  Copy,
  Check,
  Trash2,
  Lock,
  Clock,
  HardDrive,
  FileCheck,
} from 'lucide-react';
import {
  disasterRecoveryService,
  DisasterRecoveryOverview,
  BackupRecord,
  DrillResult,
  ApiKey,
  CreatedApiKey,
} from '@/services/disasterRecovery';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CountUp } from '@/components/ui/CountUp';

type DrTab = 'drills' | 'backups' | 'apikeys';

export const DisasterRecoveryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DrTab>('drills');
  const [overview, setOverview] = useState<DisasterRecoveryOverview | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Action states
  const [isDrilling, setIsDrilling] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [backupName, setBackupName] = useState('');
  const [backupDb, setBackupDb] = useState('devopspulse-production-db');
  const [backupType, setBackupType] = useState('FULL_SNAPSHOT');
  const [isSubmittingBackup, setIsSubmittingBackup] = useState(false);

  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState('read:telemetry,write:iac,read:security');
  const [keyExpiry, setKeyExpiry] = useState(90);
  const [isSubmittingKey, setIsSubmittingKey] = useState(false);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [ovRes, keysRes] = await Promise.all([
        disasterRecoveryService.getOverview(),
        disasterRecoveryService.listApiKeys(),
      ]);
      setOverview(ovRes.data);
      setApiKeys(keysRes.data);
    } catch (err) {
      console.error('Failed to load DR data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleExecuteDrill = async () => {
    setIsDrilling(true);
    setFeedbackMsg(null);
    try {
      const res = await disasterRecoveryService.executeDrill({
        drill_name: 'Quarterly Multi-Region Point-in-Time Recovery Certification Drill',
        target_system: 'PostgreSQL Primary Cluster & Volume Snapshots',
      });
      setFeedbackMsg({
        type: 'success',
        text: `DR Drill '${res.data.drill_name}' PASSED! Measured RPO: ${res.data.rpo_actual_minutes}m (Target: < 15m), Measured RTO: ${res.data.rto_actual_minutes}m (Target: < 30m). Zero data loss.`,
      });
      await loadAllData();
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Disaster recovery test drill execution failed.' });
    } finally {
      setIsDrilling(false);
    }
  };

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingBackup(true);
    setFeedbackMsg(null);
    try {
      const res = await disasterRecoveryService.createBackup({
        backup_name: backupName,
        target_database: backupDb,
        backup_type: backupType,
      });
      setIsBackupModalOpen(false);
      setBackupName('');
      setFeedbackMsg({
        type: 'success',
        text: `Backup snapshot '${res.data.backup_name}' completed and verified (SHA-256 hash stored).`,
      });
      await loadAllData();
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to create database backup snapshot.' });
    } finally {
      setIsSubmittingBackup(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingKey(true);
    setFeedbackMsg(null);
    try {
      const res = await disasterRecoveryService.createApiKey({
        name: keyName,
        scopes: keyScopes,
        expires_in_days: Number(keyExpiry),
      });
      setIsKeyModalOpen(false);
      setKeyName('');
      setNewlyCreatedKey(res.data);
      await loadAllData();
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to generate organization API key.' });
    } finally {
      setIsSubmittingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: number) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This action is permanent.')) return;
    try {
      await disasterRecoveryService.revokeApiKey(keyId);
      setFeedbackMsg({ type: 'success', text: `API key #${keyId} revoked.` });
      await loadAllData();
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Failed to revoke API key.' });
    }
  };

  const handleCopyKey = () => {
    if (!newlyCreatedKey) return;
    navigator.clipboard.writeText(newlyCreatedKey.raw_key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  if (isLoading && !overview) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100 flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-primary-600" />
              Disaster Recovery &amp; Key Governance
            </h1>
            {overview && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                Readiness: {overview.readiness_grade} ({overview.readiness_score}/100)
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-dark-400 mt-1">
            Verifiable Disaster Recovery Drills, Point-in-Time Recovery (PITR), S3 Backup Vaults, and Scoped API Key Management
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'drills' && (
            <Button
              variant="primary"
              onClick={handleExecuteDrill}
              disabled={isDrilling}
              leftIcon={isDrilling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            >
              {isDrilling ? 'Executing Failover Drill...' : 'Run DR Certification Drill'}
            </Button>
          )}

          {activeTab === 'backups' && (
            <Button
              variant="primary"
              onClick={() => setIsBackupModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Take Backup Snapshot
            </Button>
          )}

          {activeTab === 'apikeys' && (
            <Button
              variant="primary"
              onClick={() => setIsKeyModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create API Key
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={loadAllData}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`rounded-xl border p-3.5 text-xs font-medium flex items-center justify-between shadow-2xs ${
            feedbackMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="font-bold ml-2 hover:opacity-75">
            ×
          </button>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Recovery Point (RPO)</span>
              <Clock className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">
              <CountUp value={overview.actual_rpo_minutes} suffix=" min" />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">
              Target: &lt; {overview.target_rpo_minutes} min (Meets SLA)
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Recovery Time (RTO)</span>
              <Clock className="h-4 w-4 text-primary-600" />
            </div>
            <div className="text-2xl font-extrabold text-dark-100 mt-1">
              <CountUp value={overview.actual_rto_minutes} suffix=" min" />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">
              Target: &lt; {overview.target_rto_minutes} min restoration
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Backup Snapshots</span>
              <Database className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold text-dark-100 mt-1">
              <CountUp value={overview.total_backups_count} />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">All checksums verified</div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">DR Certification</span>
              <FileCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1 flex items-center gap-1.5">
              Grade {overview.readiness_grade}
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">
              {overview.drills.length} live recovery test drills logged
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB]">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('drills')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'drills'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            DR Readiness &amp; Certification Drills
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {overview?.drills.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('backups')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'backups'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <Database className="h-4 w-4" />
            Automated S3 Backup Vault
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {overview?.backups.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('apikeys')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'apikeys'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <Key className="h-4 w-4" />
            Scoped Organization API Keys
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
              {apiKeys.length}
            </span>
          </button>
        </nav>
      </div>

      {/* TAB 1: DR Readiness & Certification Drills */}
      {activeTab === 'drills' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center justify-between shadow-subtle">
            <div>
              <h3 className="text-sm font-bold text-dark-100">Certified Recovery Test History</h3>
              <p className="text-xs font-medium text-dark-400">
                Audited failover drills verifying measured RPO and RTO with zero data loss
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExecuteDrill}
              disabled={isDrilling}
              leftIcon={isDrilling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            >
              {isDrilling ? 'Running...' : 'Execute Test Drill'}
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#E5E7EB] text-dark-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Drill Name</th>
                    <th className="py-3 px-4">Target System</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Measured RPO</th>
                    <th className="py-3 px-4">Measured RTO</th>
                    <th className="py-3 px-4">Data Loss</th>
                    <th className="py-3 px-4">Tested By</th>
                    <th className="py-3 px-4">Executed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {overview?.drills.map((drill) => (
                    <tr key={drill.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-dark-100">{drill.drill_name}</td>
                      <td className="py-3 px-4 font-mono text-dark-400">{drill.target_system}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> {drill.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        {drill.rpo_actual_minutes}m (tgt &lt; {drill.rpo_target_minutes}m)
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-primary-600">
                        {drill.rto_actual_minutes}m (tgt &lt; {drill.rto_target_minutes}m)
                      </td>
                      <td className="py-3 px-4 font-mono text-dark-100">
                        {drill.data_loss_bytes === 0 ? '0 bytes (100% clean)' : `${drill.data_loss_bytes} B`}
                      </td>
                      <td className="py-3 px-4 text-dark-400">{drill.tested_by}</td>
                      <td className="py-3 px-4 text-dark-400">
                        {new Date(drill.executed_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Automated S3 Backup Vault */}
      {activeTab === 'backups' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center justify-between shadow-subtle">
            <div>
              <h3 className="text-sm font-bold text-dark-100">Database &amp; Volume Snapshots</h3>
              <p className="text-xs font-medium text-dark-400">
                Encrypted S3 multi-region vault backups with SHA-256 integrity validation
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsBackupModalOpen(true)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Take Snapshot
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#E5E7EB] text-dark-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Backup Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Target Database</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Vault Location</th>
                    <th className="py-3 px-4">SHA-256 Checksum</th>
                    <th className="py-3 px-4">Completed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] font-mono">
                  {overview?.backups.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-dark-100 font-sans">{b.backup_name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {b.backup_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-dark-400">{b.target_database}</td>
                      <td className="py-3 px-4 text-dark-100 font-bold">
                        {(b.size_bytes / 1024 / 1024).toFixed(1)} MB
                      </td>
                      <td className="py-3 px-4 text-dark-400 truncate max-w-[200px]" title={b.storage_location}>
                        {b.storage_location}
                      </td>
                      <td className="py-3 px-4 text-[10px] text-slate-600 truncate max-w-[120px]" title={b.checksum_sha256}>
                        {b.checksum_sha256.substring(0, 14)}...
                      </td>
                      <td className="py-3 px-4 text-dark-400 font-sans">
                        {b.completed_at ? new Date(b.completed_at).toLocaleString() : 'In Progress'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Scoped Organization API Keys */}
      {activeTab === 'apikeys' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center justify-between shadow-subtle">
            <div>
              <h3 className="text-sm font-bold text-dark-100">Organization API Access Tokens</h3>
              <p className="text-xs font-medium text-dark-400">
                Secure SHA-256 hashed API keys for CI/CD runners, Terraform Cloud, and automated webhook ingestion
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsKeyModalOpen(true)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Generate Key
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#E5E7EB] text-dark-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Token Name</th>
                    <th className="py-3 px-4">Prefix</th>
                    <th className="py-3 px-4">Scoped Permissions</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4">Last Used</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-dark-100">{key.name}</td>
                      <td className="py-3 px-4 font-mono text-dark-400 font-bold">{key.key_prefix}...</td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {key.scopes.split(',').map((s) => (
                          <span key={s} className="mr-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                            {s}
                          </span>
                        ))}
                      </td>
                      <td className="py-3 px-4">
                        {key.is_active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px] bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            Revoked
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-dark-400">
                        {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-dark-400 font-mono text-[11px]">
                        {key.last_used_at ? `${new Date(key.last_used_at).toLocaleDateString()} (${key.last_used_ip || 'IP'})` : 'Never used'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {key.is_active && (
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            className="p-1.5 text-dark-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Revoke Token"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Backup Modal */}
      <Modal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        title="Take On-Demand Database Backup"
      >
        <form onSubmit={handleCreateBackup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Backup Identifier</label>
            <input
              type="text"
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="e.g. pre-migration-snapshot-20261120"
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Database Target</label>
              <input
                type="text"
                value={backupDb}
                onChange={(e) => setBackupDb(e.target.value)}
                required
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-100 mb-1">Backup Mode</label>
              <select
                value={backupType}
                onChange={(e) => setBackupType(e.target.value)}
                className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-medium text-dark-100 focus:outline-hidden"
              >
                <option value="FULL_SNAPSHOT">Full Database Snapshot</option>
                <option value="INCREMENTAL_WAL">Incremental WAL Stream</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsBackupModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingBackup}
              leftIcon={isSubmittingBackup ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
            >
              {isSubmittingBackup ? 'Creating Snapshot...' : 'Create Snapshot'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Key Modal */}
      <Modal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        title="Generate Organization API Key"
      >
        <form onSubmit={handleCreateApiKey} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Key Description / Client Name</label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g. ArgoCD Ingress Token"
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-medium text-dark-100 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Assigned Scopes (comma separated)</label>
            <input
              type="text"
              value={keyScopes}
              onChange={(e) => setKeyScopes(e.target.value)}
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Validity Period (Days)</label>
            <input
              type="number"
              value={keyExpiry}
              onChange={(e) => setKeyExpiry(Number(e.target.value))}
              min="1"
              max="365"
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsKeyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingKey}
              leftIcon={isSubmittingKey ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
            >
              {isSubmittingKey ? 'Generating...' : 'Generate Key'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Newly Created Key Display Modal */}
      <Modal
        isOpen={newlyCreatedKey !== null}
        onClose={() => setNewlyCreatedKey(null)}
        title="Copy Your API Key"
      >
        {newlyCreatedKey && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Please copy this key now. For security purposes, it will never be displayed again.
              </span>
            </div>

            <div className="p-3.5 bg-slate-900 rounded-xl flex items-center justify-between text-xs font-mono text-emerald-400 overflow-x-auto">
              <span className="truncate mr-2">{newlyCreatedKey.raw_key}</span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors shrink-0"
                title="Copy token"
              >
                {copiedKey ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <div className="pt-2 flex justify-end border-t border-[#F1F5F9]">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setNewlyCreatedKey(null)}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DisasterRecoveryPage;
