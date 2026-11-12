import React, { useEffect, useState } from 'react';
import {
  Users,
  GitPullRequest,
  Rocket,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Plus,
} from 'lucide-react';
import {
  teamProductivityService,
  TeamProductivityOverview,
  Team,
} from '@/services/teamProductivity';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { CountUp } from '@/components/ui/CountUp';

export const TeamProductivityPage: React.FC = () => {
  const [overview, setOverview] = useState<TeamProductivityOverview | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Team Create Modal
  const [isTeamModalOpen, setIsTeamModalOpen] = useState<boolean>(false);
  const [teamName, setTeamName] = useState<string>('');
  const [teamDesc, setTeamDesc] = useState<string>('');
  const [isSubmittingTeam, setIsSubmittingTeam] = useState<boolean>(false);

  const fetchData = async () => {
    setError(null);
    try {
      const [overviewData, teamList] = await Promise.all([
        teamProductivityService.getOverview(selectedTeamId ? parseInt(selectedTeamId, 10) : undefined),
        teamProductivityService.listTeams(),
      ]);
      setOverview(overviewData);
      setTeams(teamList);
    } catch {
      setError('Failed to load team productivity analytics.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedTeamId]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setIsSubmittingTeam(true);
    try {
      await teamProductivityService.createTeam({
        name: teamName.trim(),
        description: teamDesc.trim() || undefined,
      });
      setIsTeamModalOpen(false);
      setTeamName('');
      setTeamDesc('');
      await fetchData();
    } catch {
      alert('Failed to register engineering team.');
    } finally {
      setIsSubmittingTeam(false);
    }
  };

  const getDoraRatingBadge = (rating: string) => {
    switch (rating) {
      case 'Elite':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Elite</span>;
      case 'High':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">High</span>;
      case 'Medium':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Medium</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">Low</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#7C3AED]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Engineering Team Productivity Analytics
            </h1>
            <p className="text-sm text-slate-500">
              Team-level DORA delivery throughput, code review cycle latency, and systemic bottleneck discovery
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Team Switcher */}
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="text-xs font-semibold rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          >
            <option value="">All Engineering Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.repository_count} repos)
              </option>
            ))}
          </select>

          <Button
            onClick={() => setIsTeamModalOpen(true)}
            className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-sm text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create Team</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Mandatory Non-Ranking Disclaimer Banner */}
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-[#7C3AED] shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wide">
            Team Health & Collaboration Focus
          </h4>
          <p className="text-xs text-purple-800 mt-0.5 leading-relaxed">
            {overview?.ranking_disclaimer ||
              'Metrics measure systemic delivery pipelines, peer review responsiveness, and pull request hygiene at the team level. DevOpsPulse prohibits individual developer rankings to foster psychological safety and high-velocity team collaboration.'}
          </p>
        </div>
      </div>

      {/* High-Level Overview Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="text-xs font-semibold text-slate-500">Delivery Velocity Score</div>
          <div className="mt-2 text-2xl font-bold text-[#7C3AED]">
            {overview ? `${overview.delivery_velocity_score.toFixed(0)}/100` : '--'}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{overview?.team_name || 'All Teams'} composite score</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="text-xs font-semibold text-slate-500">Median Time to Merge</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {overview ? `${overview.pr_metrics.median_time_to_merge_hours.toFixed(1)}h` : '--'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            From PR creation to production merge
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="text-xs font-semibold text-slate-500">Time to First Review</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {overview ? `${overview.pr_metrics.median_time_to_first_review_hours.toFixed(1)}h` : '--'}
          </div>
          <div className="mt-1 text-xs text-emerald-600">
            {overview?.pr_metrics.review_coverage_percent.toFixed(0)}% review coverage
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="text-xs font-semibold text-slate-500">Active Collaborating Engineers</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {overview ? <CountUp value={overview.total_engineers_collaborating} /> : 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across {overview?.active_repositories_count || 0} active repositories
          </div>
        </div>
      </div>

      {/* Team DORA Velocity Scorecard */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Rocket className="h-4 w-4 text-[#7C3AED]" />
              <span>Team DORA Delivery Performance</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Standardized industry benchmarks evaluated across this team's tracked repositories
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Deployment Frequency</span>
              {overview && getDoraRatingBadge(overview.dora.deployment_frequency_rating)}
            </div>
            <div className="text-xl font-bold text-slate-900">
              {overview ? `${overview.dora.deployment_frequency_per_day.toFixed(1)} / day` : '--'}
            </div>
            <p className="text-[11px] text-slate-500">Frequency of releases into production</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Lead Time for Changes</span>
              {overview && getDoraRatingBadge(overview.dora.lead_time_rating)}
            </div>
            <div className="text-xl font-bold text-slate-900">
              {overview ? `${overview.dora.lead_time_for_changes_hours.toFixed(1)} hrs` : '--'}
            </div>
            <p className="text-[11px] text-slate-500">Time from commit to live verification</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Change Failure Rate</span>
              {overview && getDoraRatingBadge(overview.dora.cfr_rating)}
            </div>
            <div className="text-xl font-bold text-slate-900">
              {overview ? `${overview.dora.change_failure_rate_percent.toFixed(1)}%` : '--'}
            </div>
            <p className="text-[11px] text-slate-500">Deployments triggering hotfix or rollback</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Mean Time to Restore</span>
              {overview && getDoraRatingBadge(overview.dora.mttr_rating)}
            </div>
            <div className="text-xl font-bold text-slate-900">
              {overview ? `${overview.dora.mttr_hours.toFixed(1)} hrs` : '--'}
            </div>
            <p className="text-[11px] text-slate-500">Recovery duration after a failure</p>
          </div>
        </div>
      </div>

      {/* PR Size Distribution & Review Hygiene */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
        <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
          <GitPullRequest className="h-4 w-4 text-[#7C3AED]" />
          <span>Pull Request Size Hygiene & Review Turnaround</span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Smaller PRs merge significantly faster with higher review thoroughness and fewer post-merge regressions
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {overview?.pr_size_distribution.map((bucket) => {
            const isSmall = bucket.label.includes('Small');
            const isLarge = bucket.label.includes('Large');
            return (
              <div
                key={bucket.label}
                className="p-4 rounded-xl border border-slate-200 bg-white space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{bucket.label}</span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isSmall
                        ? 'bg-emerald-100 text-emerald-800'
                        : isLarge
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {bucket.percentage.toFixed(0)}% of PRs
                  </span>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Average Review Duration</div>
                  <div className="text-xl font-bold text-slate-900">
                    {bucket.avg_review_hours.toFixed(1)} hours
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-600 font-medium">
                  {bucket.recommendation}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collaboration Health Insights & Bottlenecks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collaboration Insights */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#7C3AED]" />
            <span>Collaboration Health Indicators</span>
          </h3>

          <div className="space-y-3">
            {overview?.collaboration_insights.map((ci) => {
              const isOptimal = ci.status === 'OPTIMAL';
              const isAttn = ci.status === 'ATTENTION';
              return (
                <div
                  key={ci.metric}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{ci.metric}</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isOptimal
                          ? 'bg-emerald-100 text-emerald-800'
                          : isAttn
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {ci.value}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{ci.description}</p>
                  <div className="text-[11px] text-purple-700 font-medium pt-1">
                    <strong>Suggestion:</strong> {ci.action_advice}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Process Bottlenecks */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Detected Process & Delivery Bottlenecks</span>
          </h3>

          {overview?.process_bottlenecks.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              No severe delivery bottlenecks detected in current engineering cycle.
            </div>
          ) : (
            <div className="space-y-2.5">
              {overview?.process_bottlenecks.map((b, i) => (
                <div
                  key={i}
                  className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2.5"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="text-xs text-amber-900 font-medium">{b}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Team Modal */}
      <Modal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        title="Configure Engineering Team"
      >
        <form onSubmit={handleCreateTeam} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Team Name *</label>
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Core Infrastructure Squad"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={teamDesc}
              onChange={(e) => setTeamDesc(e.target.value)}
              placeholder="Primary responsibilities, service boundaries, or repository ownership..."
              className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsTeamModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmittingTeam}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs"
            >
              {isSubmittingTeam ? 'Creating...' : 'Register Team'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
