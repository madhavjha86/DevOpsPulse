import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  FileCode,
  Copy,
  Check,
} from 'lucide-react';
import { aiService, AIRootCauseAnalysis } from '@/services/ai';
import { workflowService } from '@/services/workflows';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface WorkflowRunItem {
  id: number;
  name?: string;
  run_number?: number;
  head_branch?: string;
  conclusion?: string;
}

export const AIRootCauseAnalysisPage: React.FC = () => {
  const [rcaList, setRcaList] = useState<AIRootCauseAnalysis[]>([]);
  const [selectedRCA, setSelectedRCA] = useState<AIRootCauseAnalysis | null>(null);
  const [failedRuns, setFailedRuns] = useState<WorkflowRunItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Manual or Run Selection
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [jobName, setJobName] = useState<string>('build-and-test');
  const [logExcerpt, setLogExcerpt] = useState<string>('');

  const loadData = async () => {
    setIsLoadingList(true);
    try {
      const [rcas, runsRes] = await Promise.all([
        aiService.listRCAs(20),
        workflowService.getAll(1, undefined, 'failure').catch(() => ({ data: { items: [] } })),
      ]);
      setRcaList(rcas);
      if (rcas.length > 0) {
        setSelectedRCA(rcas[0]);
      }
      const rawRuns = runsRes?.data?.items || runsRes?.data || [];
      setFailedRuns(Array.isArray(rawRuns) ? rawRuns : []);
    } catch {
      // Handled gracefully
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateRCA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRunId && !logExcerpt.trim()) {
      alert('Please select a failed workflow run or paste an error log snippet.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await aiService.generateRCA({
        workflow_run_id: selectedRunId ? parseInt(selectedRunId, 10) : undefined,
        job_name: jobName.trim() || undefined,
        log_excerpt: logExcerpt.trim() || undefined,
      });
      setSelectedRCA(result);
      setRcaList((prev) => [result, ...prev.filter((r) => r.id !== result.id)]);
      setLogExcerpt('');
    } catch {
      alert('Failed to analyze failure logs. Please ensure valid error logs are provided.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <Badge variant="danger">CRITICAL</Badge>;
      case 'HIGH':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">HIGH</span>;
      case 'MEDIUM':
        return <Badge variant="warning">MEDIUM</Badge>;
      case 'LOW':
        return <Badge variant="info">LOW</Badge>;
      default:
        return <Badge variant="neutral">{sev}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#7C3AED]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              AI Root Cause Analysis
            </h1>
            <p className="text-sm text-slate-500">
              Deterministic log & telemetry inspection, evidence citation, and executable remediation
            </p>
          </div>
        </div>
      </div>

      {/* Triage / Analyze Input Section */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
        <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[#7C3AED]" />
          <span>Analyze Failure Logs & CI/CD Telemetry</span>
        </h2>
        <form onSubmit={handleGenerateRCA} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Failed GitHub Actions Run
              </label>
              <select
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              >
                <option value="">-- Choose from recent failures or paste raw logs below --</option>
                {failedRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    Run #{run.run_number || run.id} - {run.name || 'CI Workflow'} ({run.head_branch || 'main'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Failed Job / Step Name
              </label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. build, test-suite, lint"
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Failure Log Snippet or Stack Trace (Optional if run selected)
            </label>
            <textarea
              rows={4}
              value={logExcerpt}
              onChange={(e) => setLogExcerpt(e.target.value)}
              placeholder="Paste terminal error logs, compiler tracebacks, Docker build errors, or exit code details..."
              className="w-full text-xs font-mono p-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Strict truthfulness policy: Analysis derives only from verifiable log lines. No fabricated root causes.
            </span>
            <Button
              type="submit"
              disabled={isAnalyzing}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs px-4 py-2"
            >
              {isAnalyzing ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2 text-white" />
                  <span>Inspecting Telemetry & Logs...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  <span>Generate Root Cause Analysis</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Main View: Left List of RCA / Right Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent RCA Reports */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Recent Investigations</h3>
            <span className="text-xs text-slate-500">{rcaList.length} reports</span>
          </div>

          {isLoadingList ? (
            <div className="flex h-40 items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : rcaList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center shadow-subtle">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              <p className="text-xs font-bold text-slate-800">No Failure Analyses Yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Select a failed CI/CD workflow run above to generate your first incident analysis.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rcaList.map((rca) => (
                <div
                  key={rca.id}
                  onClick={() => setSelectedRCA(rca)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedRCA?.id === rca.id
                      ? 'border-[#7C3AED] bg-purple-50/60 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono font-bold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">
                      #{rca.id}
                    </span>
                    {getSeverityBadge(rca.severity)}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{rca.summary}</h4>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate max-w-[140px] font-mono">{rca.failure_category}</span>
                    <span>{Math.round(rca.confidence_score * 100)}% confidence</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Selected RCA Detailed Report */}
        <div className="lg:col-span-2">
          {selectedRCA ? (
            <div className="space-y-4">
              {/* Report Header Card */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-subtle">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(selectedRCA.severity)}
                    <span className="text-xs font-mono font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded">
                      {selectedRCA.failure_category}
                    </span>
                    <span className="text-xs text-slate-400">
                      Investigated on {new Date(selectedRCA.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    selectedRCA.status === 'resolved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {selectedRCA.status.toUpperCase()}
                  </span>
                </div>

                {/* Summary */}
                <div className="mt-4">
                  <h2 className="text-lg font-bold text-slate-900">{selectedRCA.summary}</h2>
                  <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Verified Root Cause
                    </h4>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {selectedRCA.root_cause}
                    </p>
                  </div>
                </div>

                {/* Confidence Meter */}
                <div className="mt-4 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-purple-900">AI Confidence Score</span>
                    <span className="font-bold text-[#7C3AED]">
                      {Math.round(selectedRCA.confidence_score * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-purple-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-[#7C3AED] rounded-full transition-all duration-500"
                      style={{ width: `${Math.round(selectedRCA.confidence_score * 100)}%` }}
                    />
                  </div>
                  {selectedRCA.confidence_explanation && (
                    <p className="mt-2 text-[11px] text-purple-800">
                      <strong>Basis:</strong> {selectedRCA.confidence_explanation}
                    </p>
                  )}
                </div>

                {/* Insufficient Data Warning Banner if applicable */}
                {selectedRCA.is_insufficient_data && (
                  <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">Partial Telemetry Warning</h4>
                      <p className="text-xs text-amber-800 mt-0.5">
                        Log output was truncated or incomplete. DevOpsPulse strictly avoids fabricating details. Provide full CI logs for deeper pinpointing.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Evidence Log Snippets */}
              {selectedRCA.evidence_snippets && selectedRCA.evidence_snippets.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-[#7C3AED]" />
                    <span>Evidence & Log Line References</span>
                  </h3>
                  <div className="space-y-3">
                    {selectedRCA.evidence_snippets.map((ev, i) => (
                      <div key={i} className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto">
                        <div className="flex items-center justify-between text-slate-400 text-[11px] pb-1.5 border-b border-slate-800 mb-2">
                          <span>{ev.file_or_step || 'Job Log'} {ev.line_number ? `Line ${ev.line_number}` : ''}</span>
                          <span className="text-purple-400">{ev.type || 'EXACT_MATCH'}</span>
                        </div>
                        <pre className="text-emerald-400 whitespace-pre-wrap">{ev.raw_log}</pre>
                        {ev.explanation && (
                          <div className="mt-2 text-slate-400 text-[11px] font-sans">
                            {ev.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remediation Steps */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-[#7C3AED]" />
                  <span>Actionable Remediation Steps</span>
                </h3>
                <div className="space-y-2.5">
                  {selectedRCA.remediation_steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white text-[11px] font-bold mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="text-xs font-mono text-slate-800 pt-0.5">
                          {step}
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(step, idx)}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                        title="Copy command"
                      >
                        {copiedIndex === idx ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Patch / Diff */}
              {selectedRCA.suggested_fix_diff && (
                <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-[#7C3AED]" />
                    <span>Suggested Fix Diff</span>
                  </h3>
                  <div className="p-3 bg-slate-900 rounded-lg text-xs font-mono overflow-x-auto text-slate-200">
                    <pre className="whitespace-pre-wrap">{selectedRCA.suggested_fix_diff}</pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center shadow-subtle">
              <Sparkles className="mx-auto h-10 w-10 text-purple-400 mb-3" />
              <h3 className="text-base font-bold text-slate-900">Select an Analysis Report</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Choose an investigation from the left column or submit new error logs above to view full diagnosis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
