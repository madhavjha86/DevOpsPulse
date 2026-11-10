import api from './api';

export interface Monitor {
  id: number;
  name: string;
  url: string;
  method: string;
  interval_seconds: number;
  status: 'operational' | 'degraded' | 'down';
  uptime_percentage: number;
  avg_latency_ms: number;
  last_checked_at: string | null;
  recent_probes: number[];
}

export interface ProbeResult {
  status_code: number;
  latency_ms: number;
  is_up: boolean;
  checked_at: string;
  message: string;
}

export const monitorService = {
  list: () => api.get<Monitor[]>('/api/v1/monitors'),
  create: (data: { name: string; url: string; method?: string; interval_seconds?: number }) =>
    api.post<Monitor>('/api/v1/monitors', data),
  probe: (id: number) => api.post<ProbeResult>(`/api/v1/monitors/${id}/probe`),
  delete: (id: number) => api.delete(`/api/v1/monitors/${id}`),
};
