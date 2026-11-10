import api from './api';

export const userService = {
  getProfile: () => api.get('/api/v1/users/me'),

  updateProfile: (data: { full_name?: string; avatar_url?: string }) =>
    api.patch('/api/v1/users/me', data),

  getGithubAccounts: () => api.get('/api/v1/users/me/github-accounts'),
};
