import api from './api';

export const repositoryService = {
  getAll: (page: number = 1, per_page: number = 20) =>
    api.get('/api/v1/repositories', { params: { page, per_page } }),

  getById: (id: number) => api.get(`/api/v1/repositories/${id}`),

  importRepo: (full_name: string) =>
    api.post('/api/v1/repositories/import', { github_repo_full_name: full_name }),

  syncRepo: (id: number) => api.post(`/api/v1/repositories/${id}/sync`),

  deleteRepo: (id: number) => api.delete(`/api/v1/repositories/${id}`),

  getCommits: (id: number, page: number = 1, per_page: number = 20) =>
    api.get(`/api/v1/repositories/${id}/commits`, {
      params: { page, per_page },
    }),

  getPullRequests: (id: number, page: number = 1, per_page: number = 20) =>
    api.get(`/api/v1/repositories/${id}/pull-requests`, {
      params: { page, per_page },
    }),

  getIssues: (id: number, page: number = 1, per_page: number = 20) =>
    api.get(`/api/v1/repositories/${id}/issues`, {
      params: { page, per_page },
    }),
};
