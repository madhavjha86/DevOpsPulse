import api from './api';

export interface CanvasNode {
  id: string;
  type: 'vpc' | 'subnet' | 'ec2' | 'rds' | 's3' | 'eks' | 'alb' | 'lambda' | 'redis';
  label: string;
  x: number;
  y: number;
  config?: Record<string, any>;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string | null;
}

export interface CanvasDiagram {
  id: string;
  name: string;
  description?: string | null;
  provider: 'aws' | 'gcp' | 'azure';
  region: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  updated_at: string;
}

export interface CanvasGenerateTerraformRequest {
  provider: 'aws' | 'gcp' | 'azure';
  region: string;
  environment: string;
  nodes: CanvasNode[];
  edges?: CanvasEdge[];
}

export interface CanvasGenerateTerraformResponse {
  hcl_code: string;
  resource_count: number;
  estimated_cost_monthly_usd: number;
  security_warnings: string[];
  architecture_summary: string;
}

export interface CanvasApplyRequest {
  hcl_code: string;
  environment?: 'staging' | 'production';
  dry_run?: boolean;
}

export interface CanvasApplyResponse {
  plan_status: string;
  output: string;
  resources_to_add: number;
  resources_to_change: number;
  resources_to_destroy: number;
  duration_seconds: number;
}

export const iacCanvasApi = {
  listDiagrams: async (): Promise<CanvasDiagram[]> => {
    const res = await api.get<CanvasDiagram[]>('/api/v1/iac/canvas/diagrams');
    return res.data;
  },
  getDiagram: async (id: string): Promise<CanvasDiagram> => {
    const res = await api.get<CanvasDiagram>(`/api/v1/iac/canvas/diagrams/${id}`);
    return res.data;
  },
  saveDiagram: async (diagram: CanvasDiagram): Promise<CanvasDiagram> => {
    const res = await api.post<CanvasDiagram>('/api/v1/iac/canvas/diagrams', diagram);
    return res.data;
  },
  generateTerraform: async (payload: CanvasGenerateTerraformRequest): Promise<CanvasGenerateTerraformResponse> => {
    const res = await api.post<CanvasGenerateTerraformResponse>('/api/v1/iac/canvas/generate', payload);
    return res.data;
  },
  applyTerraform: async (payload: CanvasApplyRequest): Promise<CanvasApplyResponse> => {
    const res = await api.post<CanvasApplyResponse>('/api/v1/iac/canvas/apply', payload);
    return res.data;
  },
};
