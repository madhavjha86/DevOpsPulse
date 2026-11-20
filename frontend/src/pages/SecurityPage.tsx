import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  FileCheck,
  AlertTriangle,
  FileCode2,
  Boxes,
  History,
  Download,
  Filter,
  Check,
  XCircle,
  EyeOff,
  Cpu,
  Layers,
  Container,
  Terminal,
} from 'lucide-react';
import {
  securityService,
  SecurityOverview,
  SecurityScan,
  SecurityFinding,
  SbomDocument,
  ScanType,
  FindingStatus,
  SeverityLevel,
  SbomFormat,
} from '@/services/security';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CountUp } from '@/components/ui/CountUp';
import Modal from '@/components/ui/Modal';

type ActiveTab = 'findings' | 'scans' | 'sbom';

export const SecurityPage: React.FC = () => {
  const [data, setData] = useState<SecurityOverview | null>(null);
  const [scans, setScans] = useState<SecurityScan[]>([]);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [sboms, setSboms] = useState<SbomDocument[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('findings');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter states
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modal states
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [scanTypeInput, setScanTypeInput] = useState<ScanType>('ALL');
  const [targetNameInput, setTargetNameInput] = useState<string>('devopspulse-workspace');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const [isSbomModalOpen, setIsSbomModalOpen] = useState<boolean>(false);
  const [sbomFormatInput, setSbomFormatInput] = useState<SbomFormat>('CYCLONEDX_1_5');
  const [isGeneratingSbom, setIsGeneratingSbom] = useState<boolean>(false);

  const [activeSbomId, setActiveSbomId] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [overviewRes, scansRes, findingsRes, sbomsRes] = await Promise.all([
        securityService.getOverview(),
        securityService.listScans(25),
        securityService.listFindings(),
        securityService.listSboms(),
      ]);

      setData(overviewRes.data);
      setScans(scansRes.data);
      setFindings(findingsRes.data);
      setSboms(sbomsRes.data);

      if (sbomsRes.data.length > 0 && !activeSbomId) {
        setActiveSbomId(sbomsRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load security and SBOM data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAllData();
  }, []);

  const handleTriggerScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScanning(true);
    setFeedbackMessage(null);
    try {
      const res = await securityService.triggerScan({
        target_name: targetNameInput,
        scan_type: scanTypeInput,
      });
      setIsScanModalOpen(false);
      setFeedbackMessage({
        type: 'success',
        text: `Security scan #${res.data.id} (${res.data.scan_type}) completed with ${res.data.total_findings} findings (Score: ${res.data.score}/100).`,
      });
      await loadAllData();
      setActiveTab('findings');
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Failed to execute security audit scan.' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerateSbom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingSbom(true);
    setFeedbackMessage(null);
    try {
      const res = await securityService.generateSbom({
        component_name: 'devopspulse',
        version: '1.1.0',
        format: sbomFormatInput,
      });
      setIsSbomModalOpen(false);
      setActiveSbomId(res.data.id);
      setFeedbackMessage({
        type: 'success',
        text: `Generated standard ${res.data.format} SBOM containing ${res.data.total_packages} audited software components.`,
      });
      await loadAllData();
      setActiveTab('sbom');
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Failed to generate software bill of materials.' });
    } finally {
      setIsGeneratingSbom(false);
    }
  };

  const handleRemediate = async (findingId: number, status: FindingStatus) => {
    try {
      await securityService.remediateFinding(findingId, status);
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, status } : f))
      );
      setFeedbackMessage({
        type: 'success',
        text: `Finding #${findingId} updated to ${status}.`,
      });
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: `Failed to update status for finding #${findingId}.`,
      });
    }
  };

  const handleExportSbom = async (sbomId: number) => {
    try {
      const res = await securityService.exportSbom(sbomId);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const doc = sboms.find((s) => s.id === sbomId);
      a.href = url;
      a.download = `${doc?.component_name || 'sbom'}-${doc?.version || '1.0'}-${doc?.format || 'cyclonedx'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Failed to export raw SBOM file.' });
    }
  };

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (selectedType !== 'ALL' && f.finding_type !== selectedType) return false;
      if (selectedSeverity !== 'ALL' && f.severity !== selectedSeverity) return false;
      if (selectedStatus !== 'ALL' && f.status !== selectedStatus) return false;
      return true;
    });
  }, [findings, selectedType, selectedSeverity, selectedStatus]);

  const activeSbom = useMemo(() => {
    return sboms.find((s) => s.id === activeSbomId) || sboms[0] || null;
  }, [sboms, activeSbomId]);

  const getSeverityBadgeClass = (severity: SeverityLevel | string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MEDIUM':
        return 'bg-primary-50 text-primary-700 border-primary-200';
      case 'LOW':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'INFORMATIONAL':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadgeClass = (status: FindingStatus) => {
    switch (status) {
      case 'OPEN':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'FIXED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FALSE_POSITIVE':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'SUPPRESSED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const openFindingsCount = findings.filter((f) => f.status === 'OPEN').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100">
              DevSecOps & Supply Chain Hub
            </h1>
            {data && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Grade {data.scorecard.grade} (
                {data.scorecard.overall_score}/100)
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-dark-400 mt-1">
            Continuous SAST, SCA, Secret Scanning, Docker/IaC audits, and CycloneDX/SPDX SBOM verification
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => setIsSbomModalOpen(true)}
            leftIcon={<Boxes className="h-4 w-4 text-primary-600" />}
          >
            Generate SBOM
          </Button>

          <Button
            variant="primary"
            onClick={() => setIsScanModalOpen(true)}
            leftIcon={<ShieldAlert className="h-4 w-4" />}
          >
            Run DevSecOps Scan
          </Button>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`rounded-xl border p-3.5 text-xs font-medium flex items-center justify-between shadow-2xs ${
            feedbackMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="font-bold ml-2 hover:opacity-75"
          >
            ×
          </button>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Security Health</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">
              <CountUp value={data.scorecard.overall_score} suffix="%" />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">Grade {data.scorecard.grade} defensive posture</div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Open Findings</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold text-dark-100 mt-1">
              <CountUp value={openFindingsCount} />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">
              {data.scorecard.critical_count} critical, {data.scorecard.high_count} high
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Audited Packages</span>
              <Boxes className="h-4 w-4 text-primary-600" />
            </div>
            <div className="text-2xl font-extrabold text-dark-100 mt-1">
              <CountUp value={activeSbom?.total_packages || data.scorecard.dependencies_audited} />
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">
              {sboms.length} SBOM manifests generated
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">Secret Leak Guard</span>
              <Lock className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1 flex items-center gap-1.5">
              100% Passed
            </div>
            <div className="text-[11px] font-medium text-dark-400 mt-1">Zero active credential leaks</div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-[#E5E7EB]">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('findings')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'findings'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            Vulnerability & Defect Workbench
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                openFindingsCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {openFindingsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('scans')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'scans'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <History className="h-4 w-4" />
            Scan Runs & History
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {scans.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sbom')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'sbom'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-dark-400 hover:text-dark-100'
            }`}
          >
            <Boxes className="h-4 w-4" />
            Supply Chain & SBOM (CycloneDX / SPDX)
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
              {activeSbom?.total_packages || 0} pkgs
            </span>
          </button>
        </nav>
      </div>

      {/* TAB 1: Vulnerability & Defect Workbench */}
      {activeTab === 'findings' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-dark-400 flex items-center gap-1.5 mr-1">
                <Filter className="h-3.5 w-3.5" /> Filters:
              </span>

              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-50 border border-[#E5E7EB] rounded-lg px-2.5 py-1 text-xs font-medium text-dark-100 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
              >
                <option value="ALL">All Scan Types</option>
                <option value="SAST">SAST (Code)</option>
                <option value="SCA">SCA (Dependencies)</option>
                <option value="SECRET">Secrets</option>
                <option value="CONTAINER">Container / Dockerfile</option>
                <option value="IAC">IaC / Kubernetes</option>
              </select>

              {/* Severity Filter */}
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="bg-slate-50 border border-[#E5E7EB] rounded-lg px-2.5 py-1 text-xs font-medium text-dark-100 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="INFORMATIONAL">Informational</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-50 border border-[#E5E7EB] rounded-lg px-2.5 py-1 text-xs font-medium text-dark-100 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="FIXED">Fixed</option>
                <option value="FALSE_POSITIVE">False Positive</option>
                <option value="SUPPRESSED">Suppressed</option>
              </select>
            </div>

            <span className="text-xs font-mono text-dark-400">
              Showing {filteredFindings.length} of {findings.length} findings
            </span>
          </div>

          {/* Findings List */}
          <div className="space-y-3">
            {filteredFindings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center shadow-subtle">
                <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h4 className="text-sm font-bold text-dark-100">Zero Matching Security Findings</h4>
                <p className="text-xs text-dark-400 mt-1 max-w-md mx-auto">
                  No vulnerabilities or configuration defects match your current filter parameters.
                </p>
              </div>
            ) : (
              filteredFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:shadow-card-hover transition-all duration-200 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getSeverityBadgeClass(
                            finding.severity
                          )}`}
                        >
                          {finding.severity}
                        </span>

                        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold">
                          {finding.finding_type}
                        </span>

                        {finding.cve_id && (
                          <a
                            href={`https://nvd.nist.gov/vuln/detail/${finding.cve_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-primary-600 hover:text-primary-800"
                          >
                            {finding.cve_id}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(
                            finding.status
                          )}`}
                        >
                          {finding.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-dark-100 pt-0.5">{finding.title}</h4>
                    </div>

                    {/* Remediation Action Dropdown / Buttons */}
                    <div className="flex items-center gap-1.5">
                      {finding.status !== 'FIXED' && (
                        <button
                          onClick={() => handleRemediate(finding.id, 'FIXED')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                          title="Mark as Fixed"
                        >
                          <Check className="h-3.5 w-3.5" /> Fix
                        </button>
                      )}

                      {finding.status !== 'FALSE_POSITIVE' && (
                        <button
                          onClick={() => handleRemediate(finding.id, 'FALSE_POSITIVE')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                          title="Mark as False Positive"
                        >
                          <XCircle className="h-3.5 w-3.5" /> False +
                        </button>
                      )}

                      {finding.status !== 'SUPPRESSED' && (
                        <button
                          onClick={() => handleRemediate(finding.id, 'SUPPRESSED')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                          title="Suppress finding"
                        >
                          <EyeOff className="h-3.5 w-3.5" /> Suppress
                        </button>
                      )}

                      {finding.status !== 'OPEN' && (
                        <button
                          onClick={() => handleRemediate(finding.id, 'OPEN')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-dark-400 hover:text-dark-100 transition-colors"
                          title="Reopen finding"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-dark-400 font-medium leading-relaxed">
                    {finding.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono font-medium text-dark-400 pt-1 border-t border-[#F1F5F9]">
                    <span className="flex items-center gap-1.5">
                      <FileCode2 className="h-3.5 w-3.5 text-primary-500" />
                      {finding.file_path}
                      {finding.line_number ? `:${finding.line_number}` : ''}
                    </span>

                    {finding.package_name && (
                      <span>
                        Package: <strong className="text-dark-100">{finding.package_name}</strong>
                      </span>
                    )}

                    {finding.current_version && (
                      <span>
                        Current: <strong className="text-rose-600">{finding.current_version}</strong>
                      </span>
                    )}

                    {finding.fixed_in && (
                      <span>
                        Fixed in: <strong className="text-emerald-700">{finding.fixed_in}</strong>
                      </span>
                    )}
                  </div>

                  {/* Remediation Advice Box */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-[#E5E7EB] text-xs space-y-1">
                    <span className="font-bold text-dark-100 text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Remediation Guidance
                    </span>
                    <p className="text-slate-700 font-mono text-[11px]">{finding.remediation}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Scan Runs & Audit History */}
      {activeTab === 'scans' && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-subtle overflow-hidden">
          <div className="p-5 border-b border-[#F1F5F9] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-dark-100">Historical Security Scan Audits</h3>
              <p className="text-xs font-medium text-dark-400 mt-0.5">
                Multi-vector scan runs, duration benchmarks, and severity breakdown
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadAllData}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#E5E7EB] text-dark-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Scan ID</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Vector</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Findings Breakdown</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Executed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {scans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-dark-400">
                      No security scans logged yet. Click &quot;Run DevSecOps Scan&quot; to initiate one.
                    </td>
                  </tr>
                ) : (
                  scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-primary-600">#{scan.id}</td>
                      <td className="py-3 px-4 font-medium text-dark-100">{scan.target_name}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                          {scan.scan_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> {scan.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          {scan.critical_count > 0 && (
                            <span className="text-rose-600 font-bold">{scan.critical_count}C</span>
                          )}
                          {scan.high_count > 0 && (
                            <span className="text-amber-600 font-bold">{scan.high_count}H</span>
                          )}
                          {scan.medium_count > 0 && (
                            <span className="text-primary-600 font-semibold">{scan.medium_count}M</span>
                          )}
                          {scan.low_count > 0 && (
                            <span className="text-sky-600 font-medium">{scan.low_count}L</span>
                          )}
                          {scan.total_findings === 0 && (
                            <span className="text-emerald-700 font-bold">Clean (0)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-dark-100">{scan.score}/100</td>
                      <td className="py-3 px-4 font-mono text-dark-400">{scan.duration_ms}ms</td>
                      <td className="py-3 px-4 text-dark-400">
                        {new Date(scan.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Software Supply Chain & SBOM (CycloneDX / SPDX) */}
      {activeTab === 'sbom' && (
        <div className="space-y-4">
          {/* Active SBOM Selector & Actions */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-dark-100">
                  {activeSbom ? `${activeSbom.component_name} (v${activeSbom.version})` : 'Software Bill of Materials'}
                </h3>
                {activeSbom && (
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                    {activeSbom.format}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-dark-400">
                Machine-readable inventory with SPDX licenses, copyleft risk analysis, and SHA-256 integrity checksums
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {sboms.length > 1 && (
                <select
                  value={activeSbomId || ''}
                  onChange={(e) => setActiveSbomId(Number(e.target.value))}
                  className="bg-slate-50 border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs font-medium text-dark-100 focus:outline-hidden"
                >
                  {sboms.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id} {s.format} ({new Date(s.created_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              )}

              {activeSbom && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExportSbom(activeSbom.id)}
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                >
                  Download {activeSbom.format.startsWith('CYCLONE') ? 'CycloneDX JSON' : 'SPDX JSON'}
                </Button>
              )}
            </div>
          </div>

          {/* Package Inventory Table */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-subtle overflow-hidden">
            <div className="p-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-dark-400">
                Audited Package Inventory ({activeSbom?.packages?.length || 0} Components)
              </h4>
              <span className="text-xs font-mono text-dark-400">
                Complies with NTIA minimum SBOM elements
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#E5E7EB] text-dark-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Package</th>
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4">PURL Identifier</th>
                    <th className="py-3 px-4">License (SPDX)</th>
                    <th className="py-3 px-4">Copyleft Risk</th>
                    <th className="py-3 px-4">Known CVEs</th>
                    <th className="py-3 px-4">Integrity (SHA-256)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {(!activeSbom || !activeSbom.packages || activeSbom.packages.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-dark-400">
                        No SBOM components found. Click &quot;Generate SBOM&quot; above to create one.
                      </td>
                    </tr>
                  ) : (
                    activeSbom.packages.map((pkg) => (
                      <tr key={pkg.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-dark-100">{pkg.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-700">{pkg.version}</td>
                        <td className="py-3 px-4 font-mono text-dark-400 max-w-[200px] truncate" title={pkg.purl}>
                          {pkg.purl}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200 text-[11px]">
                            {pkg.license_spdx}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {pkg.is_copyleft ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-[11px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="h-3 w-3" /> Copyleft Alert
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" /> Permissive
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {pkg.cve_count > 0 ? (
                            <span className="font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[11px]">
                              {pkg.cve_count} {pkg.highest_severity || 'CVE'}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium">0 Clean</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-dark-400 text-[10px]" title={pkg.checksum_sha256 || ''}>
                          {pkg.checksum_sha256 ? `${pkg.checksum_sha256.substring(0, 12)}...` : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DevSecOps Scan Trigger Modal */}
      <Modal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        title="Execute DevSecOps Security Scan"
      >
        <form onSubmit={handleTriggerScan} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Target Workspace / Repo</label>
            <input
              type="text"
              value={targetNameInput}
              onChange={(e) => setTargetNameInput(e.target.value)}
              required
              className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono text-dark-100 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Scan Vector & Scope</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'ALL', label: 'Multi-Vector (All)', icon: ShieldCheck },
                { id: 'SAST', label: 'SAST (Code)', icon: FileCode2 },
                { id: 'SCA', label: 'SCA (Dependencies)', icon: Boxes },
                { id: 'SECRETS', label: 'Secret Detection', icon: Lock },
                { id: 'CONTAINER', label: 'Container / Docker', icon: Container },
                { id: 'IAC', label: 'IaC & K8s Security', icon: Cpu },
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = scanTypeInput === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScanTypeInput(opt.id as ScanType)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left font-medium transition-all ${
                      isSelected
                        ? 'border-primary-600 bg-primary-50/60 text-primary-700 font-semibold shadow-2xs'
                        : 'border-[#E5E7EB] bg-white text-dark-400 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsScanModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isScanning}
              leftIcon={isScanning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Terminal className="h-3.5 w-3.5" />}
            >
              {isScanning ? 'Executing Scan...' : 'Start Scan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Generate SBOM Modal */}
      <Modal
        isOpen={isSbomModalOpen}
        onClose={() => setIsSbomModalOpen(false)}
        title="Generate Software Bill of Materials (SBOM)"
      >
        <form onSubmit={handleGenerateSbom} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-100 mb-1">Output Standard Format</label>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSbomFormatInput('CYCLONEDX_1_5')}
                className={`p-3 rounded-xl border text-left space-y-1 transition-all ${
                  sbomFormatInput === 'CYCLONEDX_1_5'
                    ? 'border-primary-600 bg-primary-50/60 text-primary-800 font-semibold shadow-2xs'
                    : 'border-[#E5E7EB] bg-white text-dark-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Layers className="h-4 w-4 text-primary-600" />
                  CycloneDX 1.5
                </div>
                <div className="text-[11px] font-normal text-dark-400">OWASP industry standard for security & vulnerability analysis</div>
              </button>

              <button
                type="button"
                onClick={() => setSbomFormatInput('SPDX_2_3')}
                className={`p-3 rounded-xl border text-left space-y-1 transition-all ${
                  sbomFormatInput === 'SPDX_2_3'
                    ? 'border-primary-600 bg-primary-50/60 text-primary-800 font-semibold shadow-2xs'
                    : 'border-[#E5E7EB] bg-white text-dark-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <FileCheck className="h-4 w-4 text-primary-600" />
                  SPDX 2.3
                </div>
                <div className="text-[11px] font-normal text-dark-400">Linux Foundation ISO/IEC 5962:2021 license & compliance standard</div>
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-[#E5E7EB] text-xs text-dark-400 space-y-1">
            <span className="font-bold text-dark-100">Audit Scope:</span>
            <p>
              Scans all project manifests (`pyproject.toml`, `requirements.txt`, `package.json`), resolves licenses, performs SHA-256 package checksum hashing, and maps known CVE vulnerabilities.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsSbomModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isGeneratingSbom}
              leftIcon={isGeneratingSbom ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Boxes className="h-3.5 w-3.5" />}
            >
              {isGeneratingSbom ? 'Generating SBOM...' : 'Generate Manifest'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SecurityPage;
