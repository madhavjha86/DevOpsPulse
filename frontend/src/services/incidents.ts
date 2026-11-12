import api from './api';

export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export interface IncidentEvent {
  id: number;
  incident_id: number;
  user_id?: number | null;
  user_name?: string | null;
  event_type: string;
  from_value?: string | null;
  to_value?: string | null;
  message: string;
  created_at: string;
}

export interface Incident {
  id: number;
  user_id: number;
  assignee_id?: number | null;
  assignee_name?: string | null;
  repository_id?: number | null;
  repository_name?: string | null;
  workflow_run_id?: number | null;
  root_cause_analysis_id?: number | null;
  title: string;
  description: string;
  severity: IncidentSeverity;
  priority: IncidentPriority;
  status: IncidentStatus;
  service: string;
  environment: string;
  slack_channel?: string | null;
  slack_notification_sent: boolean;
  email_notification_sent: boolean;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentDetail extends Incident {
  timeline_events: IncidentEvent[];
}

export interface IncidentStats {
  total_incidents: number;
  open_incidents: number;
  critical_incidents: number;
  investigating_incidents: number;
  resolved_incidents: number;
  mttr_minutes: number;
  by_severity: Record<string, number>;
  by_service: Record<string, number>;
}

export interface IncidentCreatePayload {
  title: string;
  description: string;
  severity?: IncidentSeverity;
  priority?: IncidentPriority;
  service?: string;
  environment?: string;
  assignee_id?: number | null;
  repository_id?: number | null;
  workflow_run_id?: number | null;
  slack_channel?: string | null;
  send_email?: boolean;
  send_slack?: boolean;
}

export interface IncidentStatusUpdatePayload {
  status: IncidentStatus;
  resolution_notes?: string | null;
  comment?: string | null;
}

export const incidentService = {
  getStats: async (): Promise<IncidentStats> => {
    const res = await api.get<IncidentStats>('/api/v1/incidents/stats');
    return res.data;
  },

  listIncidents: async (params?: {
    status?: string;
    severity?: string;
    service?: string;
    limit?: number;
  }): Promise<Incident[]> => {
    const res = await api.get<Incident[]>('/api/v1/incidents', { params });
    return res.data;
  },

  getIncident: async (id: number): Promise<IncidentDetail> => {
    const res = await api.get<IncidentDetail>(`/api/v1/incidents/${id}`);
    return res.data;
  },

  createIncident: async (payload: IncidentCreatePayload): Promise<IncidentDetail> => {
    const res = await api.post<IncidentDetail>('/api/v1/incidents', payload);
    return res.data;
  },

  updateStatus: async (id: number, payload: IncidentStatusUpdatePayload): Promise<Incident> => {
    const res = await api.put<Incident>(`/api/v1/incidents/${id}/status`, payload);
    return res.data;
  },

  assignIncident: async (
    id: number,
    assignee_id: number | null,
    comment?: string
  ): Promise<Incident> => {
    const res = await api.put<Incident>(`/api/v1/incidents/${id}/assign`, {
      assignee_id,
      comment,
    });
    return res.data;
  },

  addComment: async (id: number, message: string): Promise<IncidentEvent> => {
    const res = await api.post<IncidentEvent>(`/api/v1/incidents/${id}/comments`, { message });
    return res.data;
  },

  linkRCA: async (id: number, rcaId: number): Promise<Incident> => {
    const res = await api.post<Incident>(`/api/v1/incidents/${id}/rca/${rcaId}`);
    return res.data;
  },
};
