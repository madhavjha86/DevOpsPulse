import api from './api';

export interface DoraMetric {
  name: string;
  value: string;
  numeric_value: number;
  unit: string;
  rating: 'Elite' | 'High' | 'Medium' | 'Low' | 'No Data';
  benchmark: string;
  description: string;
}

export interface DoraMetricsResponse {
  deployment_frequency: DoraMetric;
  lead_time_for_changes: DoraMetric;
  change_failure_rate: DoraMetric;
  mean_time_to_recovery: DoraMetric;
  overall_performance: 'Elite' | 'High' | 'Medium' | 'Low' | 'Insufficient Data';
}

export const analyticsService = {
  getDashboardStats: () => api.get('/api/v1/analytics/dashboard'),

  getRecentActivity: () => api.get('/api/v1/analytics/recent-activity'),

  getWorkflowPerformance: (days: number = 30) =>
    api.get('/api/v1/analytics/workflow-performance', { params: { days } }),

  getRepositoryActivity: (days: number = 30) =>
    api.get('/api/v1/analytics/repository-activity', { params: { days } }),

  getBuildTrends: (days: number = 30) =>
    api.get('/api/v1/analytics/build-trends', { params: { days } }),

  getDoraMetrics: () => api.get<DoraMetricsResponse>('/api/v1/analytics/dora'),
};
