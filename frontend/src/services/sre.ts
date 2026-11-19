import api from './api';

export type SloType = 'AVAILABILITY' | 'LATENCY' | 'ERROR_RATE' | 'THROUGHPUT';
export type SloStatus = 'HEALTHY' | 'WARNING' | 'BREACHED';
export type MetricType = 'LATENCY_P99' | 'LATENCY_P95' | 'ERROR_RATE' | 'CPU_USAGE' | 'MEMORY_USAGE';

export interface Slo {
  id: number;
  name: string;
  service_name: string;
  sli_type: string;
  target_percentage: number;
  contractual_sla_percentage: number;
  time_window_days: number;
  current_sli: number;
  error_budget_percentage: number;
  error_budget_remaining_percentage: number;
  error_budget_burn_rate_1h: number;
  error_budget_burn_rate_6h: number;
  error_budget_burn_rate_24h: number;
  warning_threshold: number;
  status: SloStatus;
  description?: string | null;
  created_at: string;
}

export interface OnCallSchedule {
  id: number;
  name: string;
  primary_engineer: string;
  secondary_engineer: string;
  rotation_type: string;
  escalation_policy: string;
  is_active: boolean;
  handoff_day: string;
  created_at: string;
}

export interface AlertRule {
  id: number;
  name: string;
  service_name: string;
  metric_type: string;
  operator: string;
  threshold_value: number;
  duration_minutes: number;
  severity: string;
  notification_channel: string;
  is_active: boolean;
  created_at: string;
}

export interface ServiceDependencyNode {
  id: string;
  name: string;
  type: string; // gateway, service, database, cache, queue
  status: string; // HEALTHY, DEGRADED, DOWN
  request_rate_rpm: number;
  error_rate_pct: number;
  latency_p95_ms: number;
}

export interface ServiceDependencyEdge {
  source: string;
  target: string;
  call_count: number;
  avg_latency_ms: number;
  error_count: number;
}

export interface ServiceDependencyMap {
  nodes: ServiceDependencyNode[];
  edges: ServiceDependencyEdge[];
}

export interface ApmServiceMetric {
  service_name: string;
  request_count: number;
  error_count: number;
  error_rate_pct: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  avg_duration_ms: number;
}

export interface ApmMetricsResponse {
  time_window_hours: number;
  total_spans: number;
  system_p95_ms: number;
  services: ApmServiceMetric[];
}

export interface ReliabilityOverview {
  overall_uptime_percentage: number;
  mttd_minutes: number;
  mttr_minutes: number;
  total_incidents_30d: number;
  active_slos_count: number;
  slos_meeting_target: number;
  slos_warning_count: number;
  slos_breached_count: number;
  active_on_call?: OnCallSchedule | null;
  slos: Slo[];
}

export const sreService = {
  getOverview: () => api.get<ReliabilityOverview>('/api/v1/sre/overview'),
  listSlos: () => api.get<Slo[]>('/api/v1/sre/slos'),
  createSlo: (payload: {
    name: string;
    service_name: string;
    sli_type: SloType;
    target_percentage: number;
    contractual_sla_percentage: number;
    time_window_days?: number;
    warning_threshold?: number;
    description?: string;
  }) => api.post<Slo>('/api/v1/sre/slos', payload),
  simulateBurn: (sloId: number, payload: { burn_rate_multiplier?: number; reduce_budget_percent?: number } = {}) =>
    api.post<Slo>(`/api/v1/sre/slos/${sloId}/simulate-burn`, {
      burn_rate_multiplier: payload.burn_rate_multiplier || 6.5,
      reduce_budget_percent: payload.reduce_budget_percent || 40.0,
    }),
  listOnCall: () => api.get<OnCallSchedule[]>('/api/v1/sre/on-call'),
  createOnCall: (payload: {
    name: string;
    primary_engineer: string;
    secondary_engineer: string;
    rotation_type?: string;
    escalation_policy?: string;
    handoff_day?: string;
  }) => api.post<OnCallSchedule>('/api/v1/sre/on-call', payload),
  listAlerts: () => api.get<AlertRule[]>('/api/v1/sre/alerts'),
  createAlert: (payload: {
    name: string;
    service_name: string;
    metric_type?: string;
    operator?: string;
    threshold_value: number;
    duration_minutes?: number;
    severity?: string;
    notification_channel?: string;
  }) => api.post<AlertRule>('/api/v1/sre/alerts', payload),
  toggleAlert: (ruleId: number) => api.patch<AlertRule>(`/api/v1/sre/alerts/${ruleId}/toggle`),
  getTopology: () => api.get<ServiceDependencyMap>('/api/v1/sre/topology'),
  getApm: (hours: number = 24) => api.get<ApmMetricsResponse>(`/api/v1/sre/apm?hours=${hours}`),
};
