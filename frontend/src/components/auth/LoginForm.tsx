import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Github, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      const msg =
        err.response?.data?.detail || 'Failed to sign in. Please verify your credentials.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubOAuth = async () => {
    try {
      const { data } = await authService.getGithubAuthUrl();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch {
      setError('Unable to initiate GitHub OAuth at this time.');
    }
  };

  return (
    <div className="w-full space-y-6">
      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="developer@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          leftIcon={<Mail className="h-4 w-4" />}
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          leftIcon={<Lock className="h-4 w-4" />}
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isLoading}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          Sign In
        </Button>
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-dark-700/60" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-dark-900 px-2 text-dark-400">or continue with</span>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={handleGitHubOAuth}
        leftIcon={<Github className="h-4 w-4" />}
      >
        Sign in with GitHub
      </Button>

      <p className="text-center text-xs text-dark-400">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-semibold text-primary-400 hover:text-primary-300">
          Create an account
        </Link>
      </p>
    </div>
  );
};
