import api from './api';

export interface ServiceCostItem {
  service_name: string;
  amount: number;
  percentage: number;
  provider: string;
}

export interface DailyCostPoint {
  date: string;
  amount: number;
  aws: number;
  azure: number;
  gcp: number;
}

export interface ProviderCostStatus {
  provider: string;
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR' | 'DEMO_MODE';
  account_name?: string | null;
  monthly_spend: number;
  is_connected: boolean;
  details?: string | null;
}

export interface Budget {
  id: number;
  name: string;
  provider: string;
  monthly_budget: number;
  warning_threshold: number;
  critical_threshold: number;
  current_spend: number;
  forecasted_spend: number;
  percentage_used: number;
  status: 'OK' | 'WARNING' | 'CRITICAL';
  alert_email?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CostOptimization {
  id: number;
  provider: string;
  title: string;
  category: string;
  resource_id: string;
  estimated_monthly_savings: number;
  difficulty: string;
  recommendation: string;
  status: string;
  created_at: string;
}

export interface CloudCostOverview {
  total_monthly_spend: number;
  projected_month_end: number;
  monthly_change_percent: number;
  currency: string;
  providers: ProviderCostStatus[];
  daily_trend: DailyCostPoint[];
  top_services: ServiceCostItem[];
  active_budgets: Budget[];
  total_potential_savings: number;
  optimizations_count: number;
  is_demo_mode: boolean;
}

export interface BudgetCreatePayload {
  name: string;
  provider?: string;
  monthly_budget: number;
  warning_threshold?: number;
  critical_threshold?: number;
  alert_email?: string;
  alert_slack_channel?: string;
}

export const cloudCostService = {
  getOverview: async (provider?: string): Promise<CloudCostOverview> => {
    const res = await api.get<CloudCostOverview>('/api/v1/cloud/cost/overview', {
      params: provider && provider !== 'ALL' ? { provider } : {},
    });
    return res.data;
  },

  listBudgets: async (): Promise<Budget[]> => {
    const res = await api.get<Budget[]>('/api/v1/cloud/cost/budgets');
    return res.data;
  },

  createBudget: async (payload: BudgetCreatePayload): Promise<Budget> => {
    const res = await api.post<Budget>('/api/v1/cloud/cost/budgets', payload);
    return res.data;
  },

  deleteBudget: async (budgetId: number): Promise<void> => {
    await api.delete(`/api/v1/cloud/cost/budgets/${budgetId}`);
  },

  listOptimizations: async (status: string = 'OPEN'): Promise<CostOptimization[]> => {
    const res = await api.get<CostOptimization[]>('/api/v1/cloud/cost/optimizations', {
      params: { status },
    });
    return res.data;
  },

  applyOptimization: async (id: number): Promise<void> => {
    await api.put(`/api/v1/cloud/cost/optimizations/${id}/apply`);
  },

  dismissOptimization: async (id: number): Promise<void> => {
    await api.put(`/api/v1/cloud/cost/optimizations/${id}/dismiss`);
  },
};
