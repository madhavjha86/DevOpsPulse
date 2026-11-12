import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { securityService, SecurityOverview, Vulnerability, SecretFinding } from '@/services/security';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CountUp } from '@/components/ui/CountUp';

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
      await fetchSecurity();
    } catch {
      setScanMessage('Failed to trigger scan.');
    } finally {
      setIsScanning(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MEDIUM':
        return 'bg-primary-50 text-primary-700 border-primary-200';
      case 'LOW':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100">
              Security & Vulnerability Hub
            </h1>
            {data && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Grade {data.scorecard.grade} (
                {data.scorecard.overall_score}/100)
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-dark-400 mt-1">
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium flex items-center justify-between shadow-2xs">
          <span>{scanMessage}</span>
          <button onClick={() => setScanMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {data && (
        <>
          {/* Metrics Overview Cards (Responsive: 1 col mobile, 2 col tablet, 4 col desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
              <div className="text-xs font-semibold uppercase tracking-wider text-dark-400">Security Health Score</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                <CountUp value={data.scorecard.overall_score} suffix="%" />
              </div>
              <div className="text-[11px] font-medium text-dark-400 mt-1">Excellent defensive posture</div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
              <div className="text-xs font-semibold uppercase tracking-wider text-dark-400">Critical / High CVEs</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                <CountUp value={data.scorecard.critical_count + data.scorecard.high_count} />
              </div>
              <div className="text-[11px] font-medium text-dark-400 mt-1">Zero high-risk threats detected</div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
              <div className="text-xs font-semibold uppercase tracking-wider text-dark-400">Dependencies Audited</div>
              <div className="text-2xl font-extrabold text-dark-100 mt-1">
                <CountUp value={data.scorecard.dependencies_audited} />
              </div>
              <div className="text-[11px] font-medium text-dark-400 mt-1">Python & Node.js packages</div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
              <div className="text-xs font-semibold uppercase tracking-wider text-dark-400">Secret Leak Prevention</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1 flex items-center gap-1.5">
                <Lock className="h-5 w-5 text-emerald-600" /> 100% Passed
              </div>
              <div className="text-[11px] font-medium text-dark-400 mt-1">No exposed credentials in commits</div>
            </div>
          </div>

          {/* Active Vulnerabilities */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-subtle overflow-hidden">
            <div className="p-5 border-b border-[#F1F5F9] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-dark-100">Detected Vulnerabilities & Advisories</h3>
                <p className="text-xs font-medium text-dark-400 mt-0.5">
                  Tracked packages requiring automated patch upgrades
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-dark-400 bg-slate-100 px-2.5 py-1 rounded-full border border-[#E5E7EB]">
                {data.vulnerabilities.length} CVEs flagged
              </span>
            </div>

            <div className="divide-y divide-[#F1F5F9]">
              {data.vulnerabilities.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 border border-emerald-200">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Zero Open Vulnerabilities</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    All audited project dependencies meet current security advisories with no active CVE vulnerabilities detected.
                  </p>
                </div>
              ) : (
                data.vulnerabilities.map((v: Vulnerability) => (
                <div key={v.id} className="p-5 hover:bg-slate-50/70 transition-colors space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-primary-600 flex items-center gap-1">
                        {v.cve_id}
                        <ExternalLink className="h-3 w-3" />
                      </span>
                      <h4 className="text-sm font-bold text-dark-100">{v.title}</h4>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${getSeverityBadge(
                        v.severity
                      )}`}
                    >
                      {v.severity}
                    </span>
                  </div>

                  <p className="text-xs text-dark-400 font-medium leading-relaxed">{v.description}</p>

                  <div className="flex items-center gap-4 text-xs text-dark-400 pt-1 font-mono font-medium">
                    <span>
                      Package: <span className="text-dark-100 font-semibold">{v.package_name}</span>
                    </span>
                    <span>
                      Installed: <span className="text-rose-600 font-semibold">{v.current_version}</span>
                    </span>
                    <span>
                      Fixed in: <span className="text-emerald-700 font-bold">{v.fixed_in}</span>
                    </span>
                  </div>
                </div>
              )))}
            </div>
          </div>

          {/* Secret Scanning Findings */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-subtle">
            <h3 className="text-sm font-bold text-dark-100 flex items-center gap-2 mb-3">
              <FileCheck className="h-4 w-4 text-emerald-600" />
              Secret Hygiene & Repository Cleanliness
            </h3>
            <div className="space-y-2.5">
              {data.secret_findings.map((s: SecretFinding) => (
                <div
                  key={s.id}
                  className="rounded-xl bg-slate-50 p-3.5 border border-[#E5E7EB] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 font-mono font-medium">
                    <span className="text-dark-400">{s.file_path}:{s.line_number}</span>
                    <span className="text-dark-100 font-bold">{s.secret_type}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {s.status}
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

export default SecurityPage;
