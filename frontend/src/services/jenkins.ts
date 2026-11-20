import api from './api';

export interface JenkinsBuild {
  id: number;
  build_number: number;
  build_url: string;
  status: string;
  duration_ms: number;
  timestamp: string;
  branch: string | null;
  commit_sha: string | null;
  triggered_by: string | null;
  estimated_duration_ms: number | null;
  console_log_snippet: string | null;
}

export interface JenkinsJob {
  id: number;
  jenkins_server_id: number;
  name: string;
  job_url: string;
  job_type: string;
  color: string;
  last_build_number: number | null;
  last_build_status: string | null;
  is_buildable: boolean;
  recent_builds: JenkinsBuild[];
}

export interface JenkinsServer {
  id: number;
  name: string;
  server_url: string;
  username: string | null;
  is_active: boolean;
  last_status: 'connected' | 'unreachable' | 'error' | 'syncing' | string;
  last_synced_at: string | null;
  error_message: string | null;
  jobs_count: number;
  jobs: JenkinsJob[];
}

export interface JenkinsServerCreatePayload {
  name: string;
  server_url: string;
  username?: string;
  api_token?: string;
}

export interface JenkinsLogResponse {
  job_name: string;
  build_number: number;
  logs: string;
  has_more_data: boolean;
}

export const jenkinsService = {
  getServers: () => api.get<JenkinsServer[]>('/api/v1/jenkins/servers'),

  createServer: (payload: JenkinsServerCreatePayload) =>
    api.post<JenkinsServer>('/api/v1/jenkins/servers', payload),

  triggerBuild: (serverId: number, jobName: string, parameters?: Record<string, string>) =>
    api.post<JenkinsBuild>(`/api/v1/jenkins/servers/${serverId}/jobs/${jobName}/build`, {
      parameters,
    }),

  getBuildLogs: (serverId: number, jobName: string, buildNumber: number) =>
    api.get<JenkinsLogResponse>(
      `/api/v1/jenkins/servers/${serverId}/jobs/${jobName}/builds/${buildNumber}/logs`
    ),
};
