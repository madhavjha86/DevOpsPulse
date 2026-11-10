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
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 text-danger-300 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
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
          leftIcon={<Mail className="h-4 w-4" />}
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="h-4 w-4" />}
          required
        />

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-dark-300 font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#E5E7EB] text-primary-600 focus:ring-primary-500/20"
            />
            Remember me
          </label>
          <a
            href="#"
            className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
          >
            Forgot password?
          </a>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full justify-center"
          isLoading={isLoading}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          Sign in
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E5E7EB]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 font-semibold text-dark-400">
            Or continue with
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={handleGitHubOAuth}
        className="w-full justify-center"
        leftIcon={<Github className="h-4 w-4" />}
      >
        Sign in with GitHub
      </Button>

      <p className="text-center text-xs text-dark-400 font-medium">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
        >
          Create one now
        </Link>
      </p>
    </div>
  );
};

export default LoginForm;
