import api from './api';

export interface WasteResource {
  id: string;
  resource_type: 'UNATTACHED_EBS' | 'IDLE_EC2' | 'ORPHANED_ALB' | 'OBSOLETE_SNAPSHOT' | 'ABANDONED_EIP';
  resource_id: string;
  name: string;
  region: string;
  monthly_waste_usd: number;
  idle_days: number;
  status: 'ACTIVE_WASTE' | 'TERMINATED' | 'EXEMPTED';
  reason: string;
}

export interface FinOpsKillerSummary {
  total_monthly_waste_usd: number;
  total_waste_resources_count: number;
  killed_savings_recovered_usd: number;
  resources: WasteResource[];
}

export interface TerminateResourceRequest {
  resource_ids: string[];
  notes?: string;
}

export interface TerminateResourceResponse {
  terminated_count: number;
  monthly_savings_recovered_usd: number;
  message: string;
}

export const finopsKillerApi = {
  getSummary: async (): Promise<FinOpsKillerSummary> => {
    const res = await api.get<FinOpsKillerSummary>('/api/v1/finops/killer/summary');
    return res.data;
  },
  terminateResources: async (req: TerminateResourceRequest): Promise<TerminateResourceResponse> => {
    const res = await api.post<TerminateResourceResponse>('/api/v1/finops/killer/terminate', req);
    return res.data;
  },
};
