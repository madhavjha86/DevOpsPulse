import api from './api';

export interface TerminalTargetItem {
  id: string;
  name: string;
  type: 'k8s' | 'docker' | 'host';
  namespace?: string | null;
  status: string;
  details: string;
}

export interface TerminalExecRequest {
  target_type: 'k8s' | 'docker' | 'host';
  target_id: string;
  command: string;
  namespace?: string | null;
  working_dir?: string | null;
}

export interface TerminalExecResponse {
  session_id: string;
  target_type: string;
  target_id: string;
  command: string;
  output: string;
  exit_code: number;
  duration_ms: number;
  timestamp: string;
}

export const terminalApi = {
  getTargets: async (): Promise<TerminalTargetItem[]> => {
    const res = await api.get<TerminalTargetItem[]>('/api/v1/terminal/targets');
    return res.data;
  },
  executeCommand: async (payload: TerminalExecRequest): Promise<TerminalExecResponse> => {
    const res = await api.post<TerminalExecResponse>('/api/v1/terminal/exec', payload);
    return res.data;
  },
  getHistory: async (limit = 50): Promise<any[]> => {
    const res = await api.get<any[]>('/api/v1/terminal/history', { params: { limit } });
    return res.data;
  },
};
