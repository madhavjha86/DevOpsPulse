import api from './api';

export interface AIEmployeeUsage {
  user_id: number;
  name: string;
  email: string;
  role: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost_usd: number;
  requests_count: number;
  monthly_cost_limit: number;
  monthly_token_limit: number;
  budget_used_percentage: number;
  budget_status: 'NORMAL' | 'WARNING' | 'EXCEEDED';
  enforcement_action: 'NOTIFY' | 'BLOCK';
}

export interface AIGovernanceSummaryMetrics {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost_usd: number;
  active_developers: number;
  total_requests: number;
  avg_cost_per_dev: number;
  timeframe_days: number;
}

export interface ToolBreakdownItem {
  tool_name: string;
  tokens: number;
  cost_usd: number;
  requests: number;
}

export interface ModelBreakdownItem {
  model_name: string;
  provider: string;
  tokens: number;
  cost_usd: number;
}

export interface DailyTrendItem {
  date: string;
  tokens: number;
  cost_usd: number;
  requests: number;
}

export interface AIGovernanceSummary {
  summary: AIGovernanceSummaryMetrics;
  tool_breakdown: ToolBreakdownItem[];
  model_breakdown: ModelBreakdownItem[];
  daily_trend: DailyTrendItem[];
  employees: AIEmployeeUsage[];
}

export interface UpdateQuotaPayload {
  monthly_cost_limit_usd: number;
  monthly_token_limit: number;
  enforcement_action: 'NOTIFY' | 'BLOCK';
}

export const aiGovernanceService = {
  getSummary: async (timeframe: number = 30): Promise<AIGovernanceSummary> => {
    const response = await api.get<AIGovernanceSummary>(`/ai-governance/summary?timeframe=${timeframe}`);
    return response.data;
  },

  updateUserQuota: async (userId: number, payload: UpdateQuotaPayload) => {
    const response = await api.put(`/ai-governance/users/${userId}/quota`, payload);
    return response.data;
  },

  ingestExternalTokens: async (payload: {
    tool_name: string;
    provider: string;
    model_name: string;
    prompt_tokens: number;
    completion_tokens: number;
    user_email?: string;
    session_id?: string;
  }) => {
    const response = await api.post('/ai-governance/ingest', payload);
    return response.data;
  },

  getExportUrl: (timeframe: number = 30): string => {
    return `${api.defaults.baseURL || '/api/v1'}/ai-governance/export?timeframe=${timeframe}`;
  },
};
