import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
  ArrowRight,
  Terminal,
  Code2,
} from 'lucide-react';
import { organizationService } from '@/services/organizations';
import { useAuth } from '@/context/AuthContext';
import type { OrganizationInviteVerifyResponse, OrganizationRoleType } from '@/types';

export const AcceptInvitationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { setAuthTokens, user: currentUser } = useAuth();

  const [verifyData, setVerifyData] = useState<OrganizationInviteVerifyResponse | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setVerifyError('Invitation token is missing. Please check your invitation link.');
      return;
    }

    const checkToken = async () => {
      try {
        setIsVerifying(true);
        setVerifyError(null);
        const data = await organizationService.verifyInvitation(token);
        setVerifyData(data);
        if (data.email) {
          // Default suggested username from email
          const suggestedUsername = data.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
          setUsername(suggestedUsername);
        }
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
              'This invitation is invalid, has expired, or was revoked.'
            : 'Failed to verify invitation. Please contact your organization administrator.';
        setVerifyError(msg);
      } finally {
        setIsVerifying(false);
      }
    };

    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!verifyData) return;

    if (!verifyData.user_exists) {
      if (!fullName.trim()) {
        setFormError('Please enter your full name.');
        return;
      }
      if (!username.trim() || username.length < 3) {
        setFormError('Username must be at least 3 characters long.');
        return;
      }
      if (!password || password.length < 8) {
        setFormError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await organizationService.acceptInvitationOnboarding({
        token,
        password: password || undefined,
        full_name: fullName.trim() || undefined,
        username: username.trim() || undefined,
      });

      // Save tokens and switch context
      setAuthTokens(res.access_token, res.refresh_token);
      localStorage.setItem('active_organization_id', String(res.organization_id));
      setAcceptedSuccess(true);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
            'Failed to accept invitation. Please verify credentials or contact administrator.'
          : 'Failed to accept invitation.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (role: OrganizationRoleType) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return {
          label: 'Super Admin',
          color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          icon: <ShieldCheck className="h-4 w-4 text-purple-400" />,
        };
      case 'ORGANIZATION_ADMIN':
        return {
          label: 'Organization Admin',
          color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          icon: <Shield className="h-4 w-4 text-indigo-400" />,
        };
      case 'DEVOPS_ENGINEER':
        return {
          label: 'DevOps Engineer',
          color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
          icon: <Terminal className="h-4 w-4 text-cyan-400" />,
        };
      case 'DEVELOPER':
        return {
          label: 'Developer',
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <Code2 className="h-4 w-4 text-emerald-400" />,
        };
      case 'SECURITY_ENGINEER':
        return {
          label: 'Security Engineer',
          color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          icon: <Shield className="h-4 w-4 text-rose-400" />,
        };
      default:
        return {
          label: 'Viewer',
          color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
          icon: <Eye className="h-4 w-4 text-slate-400" />,
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">DevOpsPulse</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-200">
          Organization Workspace Invitation
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/90 backdrop-blur-md py-8 px-6 shadow-2xl ring-1 ring-white/10 sm:rounded-2xl sm:px-10 border border-slate-800">
          {/* Loading state */}
          {isVerifying && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="h-8 w-8 text-indigo-400 animate-spin mb-4" />
              <p className="text-sm font-medium text-slate-300">Verifying secure invitation token...</p>
              <p className="text-xs text-slate-500 mt-1">Validating role and tenant boundary</p>
            </div>
          )}

          {/* Error state */}
          {!isVerifying && verifyError && (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 mb-4">
                <AlertCircle className="h-6 w-6 text-rose-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Invitation Unavailable</h3>
              <p className="mt-2 text-sm text-slate-400">{verifyError}</p>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  to="/login"
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white shadow-md transition-colors"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          )}

          {/* Success Accepted redirect state */}
          {!isVerifying && acceptedSuccess && (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Welcome to the Workspace!</h3>
              <p className="mt-2 text-sm text-slate-400">
                Invitation accepted successfully. Redirecting to your dashboard...
              </p>
              <Loader2 className="h-5 w-5 text-emerald-400 animate-spin mx-auto mt-4" />
            </div>
          )}

          {/* Valid Invitation Form */}
          {!isVerifying && !verifyError && !acceptedSuccess && verifyData && (
            <div>
              {/* Workspace details banner */}
              <div className="mb-6 rounded-xl bg-slate-800/60 p-4 border border-slate-700/60">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Invited to Workspace
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-white">
                    {verifyData.organization_name}
                  </span>
                  {(() => {
                    const badge = getRoleBadge(verifyData.role);
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${badge.color}`}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/40 text-xs text-slate-400 flex items-center justify-between">
                  <span>Invited email:</span>
                  <span className="font-mono text-slate-300">{verifyData.email}</span>
                </div>
              </div>

              {formError && (
                <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {verifyData.user_exists ? (
                  <div>
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 mb-4">
                      An account with email <span className="font-semibold text-white">{verifyData.email}</span> already exists.
                      {currentUser && currentUser.email.toLowerCase() === verifyData.email.toLowerCase()
                        ? ' You are currently signed in as this user.'
                        : ' Please enter your existing account password to join this organization.'}
                    </div>

                    {(!currentUser || currentUser.email.toLowerCase() !== verifyData.email.toLowerCase()) && (
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Account Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your existing account password"
                            required
                            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Jordan Smith"
                          required
                          className="w-full rounded-lg bg-slate-800 border border-slate-700 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. jordansmith"
                        required
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Create Your Password <span className="text-slate-500">(minimum 8 characters)</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={8}
                          className="w-full rounded-lg bg-slate-800 border border-slate-700 pl-9 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Choose a strong, unique password. Passwords are never shared or pre-assigned.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-6 inline-flex justify-center items-center py-2.5 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Setting up your account...
                    </>
                  ) : (
                    <>
                      <span>Accept Invitation & Enter Workspace</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitationPage;
