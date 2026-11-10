import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/auth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AnimatedBackground } from '@/components/layout/AnimatedBackground';

export const GitHubCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthTokens } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state') || undefined;

    if (!code) {
      setError('Authorization code missing from callback URL.');
      return;
    }

    const exchangeCode = async () => {
      try {
        const { data } = await authService.githubCallback(code, state);
        if (data.access_token && data.refresh_token) {
          setAuthTokens(data.access_token, data.refresh_token);
          navigate('/dashboard', { replace: true });
        } else {
          setError('Invalid token response received from authentication server.');
        }
      } catch (err: any) {
        const msg = err.response?.data?.detail || 'GitHub authentication exchange failed.';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    };

    exchangeCode();
  }, [searchParams, navigate, setAuthTokens]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center relative overflow-hidden">
        <AnimatedBackground />
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 shadow-card-hover relative z-10 animate-fade-in">
          <h2 className="text-lg font-bold text-dark-100 mb-2">Authentication Failed</h2>
          <p className="text-xs text-rose-600 mb-6 font-medium">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white relative overflow-hidden">
      <AnimatedBackground />
      <LoadingSpinner size="lg" message="Authenticating with GitHub..." />
    </div>
  );
};

export default GitHubCallbackPage;
