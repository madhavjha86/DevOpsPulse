import api from './api';

export const workflowService = {
  getAll: (page: number = 1, status?: string, conclusion?: string) =>
    api.get('/api/v1/workflows', {
      params: { page, status, conclusion },
    }),

  getByRepository: (repoId: number, page: number = 1) =>
    api.get(`/api/v1/workflows/repository/${repoId}`, {
      params: { page },
    }),

  syncByRepository: (repoId: number) =>
    api.post(`/api/v1/workflows/repository/${repoId}/sync`),

  getDeployments: (page: number = 1) =>
    api.get('/api/v1/workflows/deployments', { params: { page } }),

  getDeploymentsByRepository: (repoId: number, page: number = 1) =>
    api.get(`/api/v1/workflows/deployments/repository/${repoId}`, {
      params: { page },
    }),

  syncDeployments: (repoId: number) =>
    api.post(`/api/v1/workflows/deployments/repository/${repoId}/sync`),

  dispatch: (data: { repository_id: number; workflow_name: string; branch?: string }) =>
    api.post('/api/v1/workflows/dispatch', data),
};
