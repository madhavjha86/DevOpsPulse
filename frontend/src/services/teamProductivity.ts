import api from './api';

export interface PRReviewMetrics {
  median_time_to_first_review_hours: number;
  median_time_to_merge_hours: number;
  average_review_turnaround_hours: number;
  review_coverage_percent: number;
  weekly_trend: Array<{
    week: string;
    first_review_hrs: number;
    merge_hrs: number;
  }>;
}

export interface PRSizeBucket {
  label: string;
  count: number;
  percentage: number;
  avg_review_hours: number;
  recommendation: string;
}

export interface TeamDoraSummary {
  deployment_frequency_per_day: number;
  deployment_frequency_rating: string;
  lead_time_for_changes_hours: number;
  lead_time_rating: string;
  change_failure_rate_percent: number;
  cfr_rating: string;
  mttr_hours: number;
  mttr_rating: string;
}

export interface CollaborationInsight {
  metric: string;
  value: string;
  status: 'OPTIMAL' | 'ATTENTION' | 'NEEDS_IMPROVEMENT';
  description: string;
  action_advice: string;
}

export interface TeamProductivityOverview {
  team_id?: number | null;
  team_name: string;
  total_engineers_collaborating: number;
  active_repositories_count: number;
  dora: TeamDoraSummary;
  pr_metrics: PRReviewMetrics;
  pr_size_distribution: PRSizeBucket[];
  collaboration_insights: CollaborationInsight[];
  delivery_velocity_score: number;
  process_bottlenecks: string[];
  ranking_disclaimer: string;
}

export interface Team {
  id: number;
  name: string;
  description?: string | null;
  target_lead_time_hours: number;
  target_deployment_freq_per_day: number;
  target_review_time_hours: number;
  repository_count: number;
  created_at: string;
}

export interface TeamCreatePayload {
  name: string;
  description?: string;
  repository_ids?: number[];
  target_lead_time_hours?: number;
  target_deployment_freq_per_day?: number;
  target_review_time_hours?: number;
}

export const teamProductivityService = {
  getOverview: async (teamId?: number): Promise<TeamProductivityOverview> => {
    const res = await api.get<TeamProductivityOverview>(
      '/api/v1/analytics/team-productivity/overview',
      {
        params: teamId ? { team_id: teamId } : {},
      }
    );
    return res.data;
  },

  listTeams: async (): Promise<Team[]> => {
    const res = await api.get<Team[]>('/api/v1/analytics/team-productivity/teams');
    return res.data;
  },

  createTeam: async (payload: TeamCreatePayload): Promise<Team> => {
    const res = await api.post<Team>('/api/v1/analytics/team-productivity/teams', payload);
    return res.data;
  },
};
