import api from './api';

export interface PipelineStage {
  id: number;
  name: string;
  stage_type: string;
  order: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  logs: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface PipelineRun {
  id: number;
  run_number: number;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  trigger: string;
  branch: string | null;
  commit_sha: string | null;
  commit_message: string | null;
  commit_author: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  stages: PipelineStage[];
}

export interface Pipeline {
  id: number;
  name: string;
  description: string | null;
  repo_url: string | null;
  branch: string;
  trigger: string;
  is_active: boolean;
  auto_deploy: boolean;
  deploy_target: string | null;
  stages_config: Array<{ name: string; type: string; order: number }> | null;
  runs: PipelineRun[];
  created_at: string | null;
}

export interface PipelineStats {
  total_pipelines: number;
  total_runs: number;
  success_count: number;
  failed_count: number;
  success_rate: number;
  avg_duration_ms: number;
}

export interface CreatePipelinePayload {
  name: string;
  repo_url?: string;
  branch?: string;
  trigger?: string;
  description?: string;
  auto_deploy?: boolean;
  deploy_target?: string;
}

export interface TriggerRunPayload {
  commit_sha?: string;
  commit_message?: string;
  commit_author?: string;
  branch?: string;
}

export const pipelinesService = {
  getPipelines: async (): Promise<Pipeline[]> => {
    const res = await api.get('/api/v1/pipelines');
    return res.data;
  },

  getPipeline: async (id: number): Promise<Pipeline> => {
    const res = await api.get(`/api/v1/pipelines/${id}`);
    return res.data;
  },

  createPipeline: async (payload: CreatePipelinePayload): Promise<Pipeline> => {
    const res = await api.post('/api/v1/pipelines', payload);
    return res.data;
  },

  deletePipeline: async (id: number): Promise<void> => {
    await api.delete(`/api/v1/pipelines/${id}`);
  },

  triggerRun: async (id: number, payload?: TriggerRunPayload): Promise<PipelineRun> => {
    const res = await api.post(`/api/v1/pipelines/${id}/trigger`, payload || {});
    return res.data;
  },

  getRuns: async (id: number): Promise<PipelineRun[]> => {
    const res = await api.get(`/api/v1/pipelines/${id}/runs`);
    return res.data;
  },

  getRun: async (runId: number): Promise<PipelineRun> => {
    const res = await api.get(`/api/v1/pipelines/runs/${runId}`);
    return res.data;
  },

  getStageLogs: async (stageId: number): Promise<string> => {
    const res = await api.get(`/api/v1/pipelines/stages/${stageId}/logs`);
    return res.data.logs;
  },

  getStats: async (): Promise<PipelineStats> => {
    const res = await api.get('/api/v1/pipelines/stats');
    return res.data;
  },
};
