import api from './api';

export interface AIRemediationItem {
  id: string;
  incident_id?: number | null;
  title: string;
  category: 'K8S_RESOURCE_BUMP' | 'DEPLOYMENT_ROLLBACK' | 'POD_RESTART' | 'CACHE_FLUSH' | 'AUTOSCALE';
  status: 'PENDING_APPROVAL' | 'EXECUTED' | 'REJECTED';
  target_resource: string;
  description: string;
  confidence_score: number;
  before_state: string;
  after_state: string;
  rollback_guarantee: string;
  created_at: string;
  executed_at?: string | null;
  executed_by?: string | null;
}

export interface AIRemediationGenerateRequest {
  incident_id?: number | null;
  error_summary: string;
  service_name: string;
}

export interface AIRemediationActionRequest {
  notes?: string;
}

export const aiRemediationApi = {
  listRemediations: async (): Promise<AIRemediationItem[]> => {
    const res = await api.get<AIRemediationItem[]>('/api/v1/ai/remediations');
    return res.data;
  },
  generateProposal: async (payload: AIRemediationGenerateRequest): Promise<AIRemediationItem> => {
    const res = await api.post<AIRemediationItem>('/api/v1/ai/remediations/generate', payload);
    return res.data;
  },
  approveRemediation: async (id: string, notes?: string): Promise<AIRemediationItem> => {
    const res = await api.post<AIRemediationItem>(`/api/v1/ai/remediations/${id}/approve`, { notes });
    return res.data;
  },
  rejectRemediation: async (id: string, notes?: string): Promise<AIRemediationItem> => {
    const res = await api.post<AIRemediationItem>(`/api/v1/ai/remediations/${id}/reject`, { notes });
    return res.data;
  },
};
