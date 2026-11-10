import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Clock,
  Code2,
  FileCode,
  Gauge,
  GitCommit,
  GitPullRequest,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  aiCodeIntelligenceService,
  AIFailurePrediction,
  AIPullRequestReview,
} from '../services/aiCodeIntelligence';

export const AICodeIntelligencePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'reviewer' | 'predictions'>('reviewer');

  // PR Reviewer State
  const [reviews, setReviews] = useState<AIPullRequestReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [selectedReview, setSelectedReview] = useState<AIPullRequestReview | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newPrTitle, setNewPrTitle] = useState('feat: Add Payment Webhook Handler');
  const [newPrNumber, setNewPrNumber] = useState(48);
  const [newPrDiff, setNewPrDiff] = useState(
    '--- a/app/core/auth.py\n+++ b/app/core/auth.py\n@@ -10,3 +10,4 @@\n+API_KEY = "sk_live_9981249182479182"\n+def verify_token(token):\n+    pass\n'
  );
  const [generatingReview, setGeneratingReview] = useState(false);

  // Predictions State
  const [predictions, setPredictions] = useState<AIFailurePrediction[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [isPredictModalOpen, setIsPredictModalOpen] = useState(false);
  const [predCommitSha, setPredCommitSha] = useState('f8e12d9');
  const [predBranch, setPredBranch] = useState('main');
  const [predFiles, setPredFiles] = useState('backend/app/core/security.py\nbackend/alembic/versions/008_auth.py');
  const [predAdditions, setPredAdditions] = useState(340);
  const [predDeletions, setPredDeletions] = useState(45);
  const [evaluatingRisk, setEvaluatingRisk] = useState(false);

  const fetchReviews = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const data = await aiCodeIntelligenceService.listPRReviews();
      setReviews(data);
      if (data.length > 0 && !selectedReview) {
        setSelectedReview(data[0]);
      }
    } catch (err) {
      console.error('Failed to load PR reviews', err);
    } finally {
      setLoadingReviews(false);
    }
  }, [selectedReview]);

  const fetchPredictions = useCallback(async () => {
    setLoadingPredictions(true);
    try {
      const data = await aiCodeIntelligenceService.listPredictions();
      setPredictions(data);
    } catch (err) {
      console.error('Failed to load failure predictions', err);
    } finally {
      setLoadingPredictions(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reviewer') {
      fetchReviews();
    } else {
      fetchPredictions();
    }
  }, [activeTab, fetchReviews, fetchPredictions]);

  const handleTriggerPRReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrDiff.trim() || generatingReview) return;
    setGeneratingReview(true);
    try {
      const created = await aiCodeIntelligenceService.reviewPullRequest({
        pr_number: Number(newPrNumber),
        pr_title: newPrTitle.trim(),
        diff_content: newPrDiff.trim(),
      });
      setReviews((prev) => [created, ...prev]);
      setSelectedReview(created);
      setIsReviewModalOpen(false);
    } catch (err) {
      console.error('Review generation failed', err);
    } finally {
      setGeneratingReview(false);
    }
  };

  const handleEvaluateRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (evaluatingRisk) return;
    setEvaluatingRisk(true);
    const filesList = predFiles
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    try {
      const created = await aiCodeIntelligenceService.predictFailure({
        commit_sha: predCommitSha.trim(),
        branch: predBranch.trim(),
        changed_files: filesList,
        additions: Number(predAdditions),
        deletions: Number(predDeletions),
      });
      setPredictions((prev) => [created, ...prev]);
      setIsPredictModalOpen(false);
    } catch (err) {
      console.error('Risk evaluation failed', err);
    } finally {
      setEvaluatingRisk(false);
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'APPROVE':
        return (
          <Badge variant="success" dot>
            APPROVE
          </Badge>
        );
      case 'REQUEST_CHANGES':
        return (
          <Badge variant="danger" dot>
            CHANGES REQUESTED
          </Badge>
        );
      default:
        return (
          <Badge variant="warning" dot>
            COMMENT
          </Badge>
        );
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <Badge variant="danger">{level} RISK</Badge>;
      case 'HIGH':
        return <Badge variant="warning">{level} RISK</Badge>;
      case 'MODERATE':
        return <Badge variant="info">{level} RISK</Badge>;
      default:
        return <Badge variant="success">{level} RISK</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-2">
            <Code2 className="h-7 w-7 text-primary-600" />
            AI Code Reviewer &amp; Failure Predictor
          </h1>
          <p className="text-sm text-dark-400 mt-1">
            Automated PR diff security auditing, architectural linting, and pre-flight CI/CD risk assessment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'reviewer' ? (
            <Button variant="primary" size="sm" onClick={() => setIsReviewModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Review Pull Request
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setIsPredictModalOpen(true)}>
              <Gauge className="h-4 w-4 mr-1.5" />
              Evaluate Commit Risk
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5E7EB] space-x-6">
        <button
          onClick={() => setActiveTab('reviewer')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'reviewer'
              ? 'border-primary-600 text-primary-600 font-bold'
              : 'border-transparent text-dark-400 hover:text-dark-100'
          }`}
        >
          <GitPullRequest className="h-4 w-4" />
          AI Pull Request Reviewer
        </button>
        <button
          onClick={() => setActiveTab('predictions')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'predictions'
              ? 'border-primary-600 text-primary-600 font-bold'
              : 'border-transparent text-dark-400 hover:text-dark-100'
          }`}
        >
          <Gauge className="h-4 w-4" />
          CI/CD Failure Risk Prediction
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AI PULL REQUEST CODE REVIEWER */}
      {/* ========================================================================= */}
      {activeTab === 'reviewer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Review Threads List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="glass-card p-3 flex items-center justify-between text-xs text-dark-400">
              <span className="font-semibold uppercase tracking-wider">Reviewed Pull Requests</span>
              <span>{reviews.length} Audited</span>
            </div>

            <div className="glass-card divide-y divide-[#E5E7EB] max-h-[660px] overflow-y-auto">
              {loadingReviews ? (
                <div className="p-8 text-center text-dark-400 text-xs">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary-600" />
                  Loading PR reviews...
                </div>
              ) : reviews.length === 0 ? (
                <div className="p-8 text-center text-dark-400 text-xs">
                  No pull requests reviewed yet.
                </div>
              ) : (
                reviews.map((r) => {
                  const isSelected = selectedReview?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedReview(r)}
                      className={`p-4 cursor-pointer transition-colors space-y-2 ${
                        isSelected
                          ? 'bg-primary-50/70 border-l-4 border-l-primary-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-dark-100 truncate">
                          #{r.pr_number} {r.pr_title}
                        </span>
                        {getVerdictBadge(r.review_verdict)}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-dark-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Shield
                            className={`h-3 w-3 ${
                              r.security_score >= 80 ? 'text-emerald-600' : 'text-danger-600'
                            }`}
                          />
                          Health Score: {r.security_score}/100
                        </span>
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>

                      <p className="text-[11px] text-dark-400 truncate">{r.summary}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Review Findings (7 cols) */}
          <div className="lg:col-span-7">
            {!selectedReview ? (
              <div className="glass-card p-12 text-center text-dark-400 text-sm">
                Select a pull request from the left list to inspect security findings and diff suggestions.
              </div>
            ) : (
              <div className="glass-card p-6 space-y-6">
                {/* Review Header Banner */}
                <div className="border-b border-[#E5E7EB] pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {getVerdictBadge(selectedReview.review_verdict)}
                        <span className="text-xs font-mono text-dark-400">
                          PR #{selectedReview.pr_number}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-dark-100 mt-1.5">{selectedReview.pr_title}</h2>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-[#E5E7EB]">
                      {selectedReview.security_score >= 80 ? (
                        <ShieldCheck className="h-7 w-7 text-emerald-600" />
                      ) : (
                        <ShieldAlert className="h-7 w-7 text-danger-600" />
                      )}
                      <div>
                        <span className="text-[10px] text-dark-400 uppercase font-semibold block">
                          Security Score
                        </span>
                        <span
                          className={`text-lg font-bold font-mono ${
                            selectedReview.security_score >= 80
                              ? 'text-emerald-600'
                              : 'text-danger-600'
                          }`}
                        >
                          {selectedReview.security_score}/100
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-dark-200 mt-3 leading-relaxed font-sans bg-slate-50 p-3 rounded-xl border border-[#E5E7EB]">
                    {selectedReview.summary}
                  </p>
                </div>

                {/* Findings List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-dark-400 uppercase tracking-wider">
                    <span>Audit Findings ({selectedReview.findings.length})</span>
                    <span>Rule Category</span>
                  </div>

                  {selectedReview.findings.length === 0 ? (
                    <div className="p-6 text-center text-xs text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Clean Bill of Health! Zero vulnerabilities, secret leaks, or anti-patterns detected.
                    </div>
                  ) : (
                    selectedReview.findings.map((f, idx) => {
                      const isCritical = f.severity === 'CRITICAL';
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border space-y-2.5 ${
                            isCritical
                              ? 'bg-rose-50 border-rose-200'
                              : 'bg-slate-50/80 border-[#E5E7EB]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              {isCritical ? (
                                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                              )}
                              <span className="font-mono text-dark-100 font-semibold">
                                {f.file} {f.line ? `:${f.line}` : ''}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-md bg-white border border-[#E5E7EB] text-primary-700 text-[10px] font-sans font-medium">
                              {f.category}
                            </span>
                          </div>

                          <p className="text-xs text-dark-200 leading-relaxed font-sans">{f.message}</p>

                          {f.suggestion_diff && (
                            <div className="mt-2 p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed text-slate-100">
                              {f.suggestion_diff.split('\n').map((line, lIdx) => (
                                <div
                                  key={lIdx}
                                  className={
                                    line.startsWith('+')
                                      ? 'text-emerald-400 bg-emerald-500/10 px-1'
                                      : line.startsWith('-')
                                      ? 'text-rose-400 bg-rose-500/10 px-1'
                                      : 'text-slate-400'
                                  }
                                >
                                  {line}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CI/CD FAILURE RISK PREDICTOR */}
      {/* ========================================================================= */}
      {activeTab === 'predictions' && (
        <div className="space-y-6">
          {/* Scorecards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between text-dark-400 mb-2">
                <span className="text-xs uppercase font-semibold">Pre-Flight Predictions</span>
                <Gauge className="h-5 w-5 text-primary-600" />
              </div>
              <div className="text-2xl font-bold text-dark-100">{predictions.length}</div>
              <p className="text-xs text-dark-400 mt-1">Commits evaluated</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center justify-between text-dark-400 mb-2">
                <span className="text-xs uppercase font-semibold">High/Critical Flags</span>
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div className="text-2xl font-bold text-rose-600">
                {predictions.filter((p) => p.risk_level === 'HIGH' || p.risk_level === 'CRITICAL').length}
              </div>
              <p className="text-xs text-dark-400 mt-1">Elevated failure risk</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center justify-between text-dark-400 mb-2">
                <span className="text-xs uppercase font-semibold">Average Risk Score</span>
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-amber-600">
                {predictions.length > 0
                  ? (
                      (predictions.reduce((acc, p) => acc + p.risk_score, 0) / predictions.length) *
                      100
                    ).toFixed(0) + '%'
                  : '0%'}
              </div>
              <p className="text-xs text-dark-400 mt-1">Historical blast radius score</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center justify-between text-dark-400 mb-2">
                <span className="text-xs uppercase font-semibold">Prevention Rate</span>
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-600">92.4%</div>
              <p className="text-xs text-dark-400 mt-1">Pre-flight issues caught early</p>
            </div>
          </div>

          {/* Predictions Grid */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-dark-100 flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-primary-600" />
                Commit Pre-Flight Failure Assessments
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchPredictions}
                isLoading={loadingPredictions}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {predictions.map((p) => {
                const pct = (p.risk_score * 100).toFixed(0);
                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-white border border-[#E5E7EB] shadow-subtle space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <GitCommit className="h-4 w-4 text-primary-600" />
                        <span className="font-bold text-dark-100">{p.commit_sha}</span>
                        <span className="text-dark-400 text-[11px]">on {p.branch}</span>
                      </div>
                      {getRiskBadge(p.risk_level)}
                    </div>

                    {/* Risk Probability Bar */}
                    <div>
                      <div className="flex justify-between text-xs text-dark-400 mb-1 font-mono">
                        <span>Failure Probability:</span>
                        <span className="font-bold text-dark-100">{pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            p.risk_score >= 0.7
                              ? 'bg-rose-500'
                              : p.risk_score >= 0.4
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Risk Factors */}
                    {p.risk_factors.length > 0 && (
                      <div className="space-y-1 text-xs">
                        <span className="text-dark-400 uppercase font-semibold text-[10px] tracking-wider block">
                          Risk Factors
                        </span>
                        {p.risk_factors.map((rf, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-dark-200">
                            <span className="text-amber-500 font-bold">•</span>
                            <span>{rf}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pre-flight Recommendations */}
                    {p.recommendations.length > 0 && (
                      <div className="pt-2 border-t border-[#E5E7EB] text-xs">
                        <span className="text-primary-700 uppercase font-semibold text-[10px] tracking-wider block mb-1">
                          Pre-Flight Checklist
                        </span>
                        {p.recommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-emerald-800 text-[11px]">
                            <CheckCircle className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Manual PR Review Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Audit Pull Request Code Diff"
      >
        <form onSubmit={handleTriggerPRReview} className="space-y-4">
          <Input
            label="Pull Request Title"
            placeholder="e.g., feat: Add Payment Webhook Handler"
            value={newPrTitle}
            onChange={(e) => setNewPrTitle(e.target.value)}
            required
          />

          <Input
            label="Pull Request Number"
            type="number"
            value={newPrNumber}
            onChange={(e) => setNewPrNumber(Number(e.target.value))}
            required
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-dark-300">Git Diff / Patch</label>
            <textarea
              rows={8}
              placeholder="Paste unified diff here..."
              value={newPrDiff}
              onChange={(e) => setNewPrDiff(e.target.value)}
              required
              className="w-full bg-white border border-[#E5E7EB] rounded-xl p-3 text-xs text-dark-100 font-mono focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsReviewModalOpen(false)}
              disabled={generatingReview}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={generatingReview}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Generate Review
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manual Risk Evaluation Modal */}
      <Modal
        isOpen={isPredictModalOpen}
        onClose={() => setIsPredictModalOpen(false)}
        title="Evaluate Pre-Flight CI/CD Failure Risk"
      >
        <form onSubmit={handleEvaluateRisk} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Commit SHA"
              placeholder="e.g., a8c14f2"
              value={predCommitSha}
              onChange={(e) => setPredCommitSha(e.target.value)}
              required
            />
            <Input
              label="Branch"
              placeholder="e.g., main"
              value={predBranch}
              onChange={(e) => setPredBranch(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Lines Added (+)"
              type="number"
              value={predAdditions}
              onChange={(e) => setPredAdditions(Number(e.target.value))}
              required
            />
            <Input
              label="Lines Deleted (-)"
              type="number"
              value={predDeletions}
              onChange={(e) => setPredDeletions(Number(e.target.value))}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-dark-300">Modified Files (1 per line)</label>
            <textarea
              rows={5}
              placeholder="backend/app/core/auth.py&#10;backend/alembic/versions/008_auth.py"
              value={predFiles}
              onChange={(e) => setPredFiles(e.target.value)}
              required
              className="w-full bg-white border border-[#E5E7EB] rounded-xl p-3 text-xs text-dark-100 font-mono focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsPredictModalOpen(false)}
              disabled={evaluatingRisk}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={evaluatingRisk}>
              <Gauge className="h-4 w-4 mr-1.5" />
              Calculate Risk
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
