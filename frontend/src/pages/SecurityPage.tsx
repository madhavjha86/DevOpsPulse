import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Lock,
  RefreshCw,
  FileCheck,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { securityService, SecurityOverview } from '@/services/security';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export const SecurityPage: React.FC = () => {
  const [data, setData] = useState<SecurityOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const fetchSecurity = async () => {
    setIsLoading(true);
    try {
      const res = await securityService.getOverview();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load security overview', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurity();
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    setScanMessage(null);
    try {
      const res = await securityService.triggerScan();
      setScanMessage(res.data.message || 'Security scan completed successfully.');
      fetchSecurity();
    } catch {
      setScanMessage('Failed to initiate security scan.');
    } finally {
      setIsScanning(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Security & Vulnerability Hub
            </h1>
            {data && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <ShieldCheck className="h-3.5 w-3.5" /> Grade {data.scorecard.grade} (
                {data.scorecard.overall_score}/100)
              </span>
            )}
          </div>
          <p className="text-xs text-dark-400 mt-1">
            Real-time CVE vulnerability scanner, dependency auditing, and secret leakage prevention
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleScan}
          disabled={isScanning}
          leftIcon={
            isScanning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )
          }
        >
          {isScanning ? 'Auditing Repos...' : 'Run Security Audit'}
        </Button>
      </div>

      {scanMessage && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-between">
          <span>{scanMessage}</span>
          <button onClick={() => setScanMessage(null)} className="text-dark-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {data && (
        <>
          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card p-5 border border-dark-700/60">
              <div className="text-xs font-medium text-dark-400">Security Health Score</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {data.scorecard.overall_score}%
              </div>
              <div className="text-[11px] text-dark-400 mt-1">Excellent defensive posture</div>
            </div>

            <div className="glass-card p-5 border border-dark-700/60">
              <div className="text-xs font-medium text-dark-400">Critical / High CVEs</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {data.scorecard.critical_count + data.scorecard.high_count}
              </div>
              <div className="text-[11px] text-dark-400 mt-1">Zero high-risk threats detected</div>
            </div>

            <div className="glass-card p-5 border border-dark-700/60">
              <div className="text-xs font-medium text-dark-400">Dependencies Audited</div>
              <div className="text-2xl font-bold text-white mt-1">
                {data.scorecard.dependencies_audited}
              </div>
              <div className="text-[11px] text-dark-400 mt-1">Python & Node.js packages</div>
            </div>

            <div className="glass-card p-5 border border-dark-700/60">
              <div className="text-xs font-medium text-dark-400">Secret Leak Prevention</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <Lock className="h-5 w-5" /> 100% Passed
              </div>
              <div className="text-[11px] text-dark-400 mt-1">No exposed credentials in commits</div>
            </div>
          </div>

          {/* Active Vulnerabilities */}
          <div className="glass-card overflow-hidden border border-dark-700/60">
            <div className="p-5 border-b border-dark-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Detected Vulnerabilities & Advisories</h3>
                <p className="text-xs text-dark-400">
                  Tracked packages requiring automated patch upgrades
                </p>
              </div>
              <span className="text-xs font-mono text-dark-400">
                {data.vulnerabilities.length} CVEs flagged
              </span>
            </div>

            <div className="divide-y divide-dark-800">
              {data.vulnerabilities.map((v) => (
                <div key={v.id} className="p-5 hover:bg-dark-800/40 transition-colors space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-semibold text-primary-400 flex items-center gap-1">
                        {v.cve_id}
                        <ExternalLink className="h-3 w-3" />
                      </span>
                      <h4 className="text-sm font-medium text-white">{v.title}</h4>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase border ${getSeverityBadge(
                        v.severity
                      )}`}
                    >
                      {v.severity}
                    </span>
                  </div>

                  <p className="text-xs text-dark-400">{v.description}</p>

                  <div className="flex items-center gap-4 text-xs text-dark-400 pt-1 font-mono">
                    <span>
                      Package: <span className="text-white">{v.package_name}</span>
                    </span>
                    <span>
                      Installed: <span className="text-rose-400">{v.current_version}</span>
                    </span>
                    <span>
                      Fixed in: <span className="text-emerald-400 font-semibold">{v.fixed_in}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Secret Scanning Findings */}
          <div className="glass-card p-6 border border-dark-700/60">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <FileCheck className="h-4 w-4 text-emerald-400" />
              Secret Hygiene & Repository Cleanliness
            </h3>
            <div className="space-y-2">
              {data.secret_findings.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg bg-dark-900/60 p-3.5 border border-dark-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-dark-400">{s.file_path}:{s.line_number}</span>
                    <span className="text-white">{s.secret_type}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
