import api from './api';

export interface TelemetryLog {
  id: number;
  service_name: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'FATAL';
  message: string;
  timestamp: string;
  trace_id?: string;
  span_id?: string;
  attributes: Record<string, unknown>;
}

export interface TelemetryLogQueryResponse {
  total: number;
  logs: TelemetryLog[];
}

export interface TelemetrySpan {
  id: number;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  name: string;
  service_name: string;
  kind: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status_code: 'OK' | 'ERROR' | 'UNSET';
  status_message?: string;
  attributes: Record<string, unknown>;
}

export interface TelemetryTraceSummary {
  trace_id: string;
  root_service: string;
  root_name: string;
  start_time: string;
  duration_ms: number;
  span_count: number;
  has_error: boolean;
  services: string[];
}

export interface TelemetryTraceDetailResponse {
  trace_id: string;
  root_span_name: string;
  duration_ms: number;
  spans: TelemetrySpan[];
}

export interface TelemetryStats {
  total_logs_24h: number;
  error_logs_24h: number;
  total_traces_24h: number;
  p95_latency_ms: number;
  active_services_count: number;
}

export interface LogFilterParams {
  service_name?: string;
  level?: string;
  search?: string;
  trace_id?: string;
  limit?: number;
  offset?: number;
}

export interface TraceFilterParams {
  service_name?: string;
  has_error?: boolean;
  limit?: number;
}

export const telemetryService = {
  getLogs: async (params?: LogFilterParams): Promise<TelemetryLogQueryResponse> => {
    const res = await api.get<TelemetryLogQueryResponse>('/api/v1/telemetry/logs', { params });
    return res.data;
  },

  getTraces: async (params?: TraceFilterParams): Promise<TelemetryTraceSummary[]> => {
    const res = await api.get<TelemetryTraceSummary[]>('/api/v1/telemetry/traces', { params });
    return res.data;
  },

  getTraceDetail: async (traceId: string): Promise<TelemetryTraceDetailResponse> => {
    const res = await api.get<TelemetryTraceDetailResponse>(`/api/v1/telemetry/traces/${traceId}`);
    return res.data;
  },

  getServices: async (): Promise<string[]> => {
    const res = await api.get<string[]>('/api/v1/telemetry/services');
    return res.data;
  },

  getStats: async (): Promise<TelemetryStats> => {
    const res = await api.get<TelemetryStats>('/api/v1/telemetry/stats');
    return res.data;
  },
};
