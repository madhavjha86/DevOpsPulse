import api from './api';

export const authService = {
  login: (email: string, password: string) =>
    api.post('/api/v1/auth/login', { email, password }),

  register: (data: {
    email: string;
    username: string;
    password: string;
    full_name: string;
  }) => api.post('/api/v1/auth/register', data),

  refreshToken: (refresh_token: string) =>
    api.post('/api/v1/auth/refresh', { refresh_token }),

  changePassword: (data: { old_password: string; new_password: string }) =>
    api.post('/api/v1/auth/change-password', data),

  getGithubAuthUrl: () => api.get('/api/v1/auth/github/authorize'),

  githubCallback: (code: string, state?: string) =>
    api.get('/api/v1/auth/github/callback', { params: { code, state } }),
};
