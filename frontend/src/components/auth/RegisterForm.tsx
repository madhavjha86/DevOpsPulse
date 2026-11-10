import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, AtSign, Github, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export const RegisterForm: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        email,
        username,
        password,
        full_name: fullName,
      });
      navigate('/dashboard');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      let msg = 'Failed to create account. Please try again.';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        msg = detail
          .map((d: any) => {
            const field = d.loc?.[d.loc?.length - 1] || 'Field';
            if (field === 'username') {
              return 'Username can only contain letters, numbers, underscores (_), and hyphens (-). Do not use "@" or special symbols.';
            }
            return `${field}: ${d.msg}`;
          })
          .join('. ');
      }
      setError(msg);
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
          label="Full Name"
          type="text"
          placeholder="Jane Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          leftIcon={<User className="h-4 w-4" />}
        />

        <Input
          label="Username"
          type="text"
          placeholder="janedoe"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          leftIcon={<AtSign className="h-4 w-4" />}
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="jane@company.com"
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

        <Input
          label="Confirm Password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          Create Account
        </Button>
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-dark-700/60" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-dark-900 px-2 text-dark-400">or register with</span>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={handleGitHubOAuth}
        leftIcon={<Github className="h-4 w-4" />}
      >
        Sign up with GitHub
      </Button>

      <p className="text-center text-xs text-dark-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary-400 hover:text-primary-300">
          Sign in
        </Link>
      </p>
    </div>
  );
};
