import api from './api';

export interface AIMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  context_metadata: Record<string, unknown>;
  created_at: string;
}

export interface AIConversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface AIConversationDetail {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages: AIMessage[];
}

export interface AIRootCauseAnalysis {
  id: number;
  workflow_run_id?: number | null;
  repository_id?: number | null;
  failure_category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  root_cause: string;
  remediation_steps: string[];
  suggested_fix_diff?: string | null;
  confidence_score: number;
  status: 'generated' | 'acknowledged' | 'resolved';
  created_at: string;
}

export interface GenerateRCARequest {
  workflow_run_id?: number | null;
  repository_id?: number | null;
  log_excerpt?: string | null;
  job_name?: string | null;
}

export const aiService = {
  getConversations: async (): Promise<AIConversation[]> => {
    const res = await api.get<AIConversation[]>('/api/v1/ai/conversations');
    return res.data;
  },

  createConversation: async (payload: {
    title?: string;
    initial_message?: string;
    context_metadata?: Record<string, unknown>;
  }): Promise<AIConversationDetail> => {
    const res = await api.post<AIConversationDetail>('/api/v1/ai/conversations', payload);
    return res.data;
  },

  getConversation: async (id: number): Promise<AIConversationDetail> => {
    const res = await api.get<AIConversationDetail>(`/api/v1/ai/conversations/${id}`);
    return res.data;
  },

  sendMessage: async (
    conversationId: number,
    payload: { content: string; context_metadata?: Record<string, unknown> }
  ): Promise<AIMessage> => {
    const res = await api.post<AIMessage>(
      `/api/v1/ai/conversations/${conversationId}/messages`,
      payload
    );
    return res.data;
  },

  deleteConversation: async (id: number): Promise<void> => {
    await api.delete(`/api/v1/ai/conversations/${id}`);
  },

  generateRCA: async (payload: GenerateRCARequest): Promise<AIRootCauseAnalysis> => {
    const res = await api.post<AIRootCauseAnalysis>('/api/v1/ai/rca/generate', payload);
    return res.data;
  },

  listRCAs: async (limit: number = 50): Promise<AIRootCauseAnalysis[]> => {
    const res = await api.get<AIRootCauseAnalysis[]>('/api/v1/ai/rca', { params: { limit } });
    return res.data;
  },

  updateRCAStatus: async (
    id: number,
    status: 'acknowledged' | 'resolved'
  ): Promise<AIRootCauseAnalysis> => {
    const res = await api.put<AIRootCauseAnalysis>(`/api/v1/ai/rca/${id}/status`, { status });
    return res.data;
  },
};
