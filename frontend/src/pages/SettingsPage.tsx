import React, { useEffect, useState } from 'react';
import { User, Github, Shield, Bell, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/auth';
import { userService } from '@/services/users';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { GitHubAccount } from '@/types';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();

  // Profile Form state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password Form state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // GitHub integration state
  const [githubAccounts, setGithubAccounts] = useState<GitHubAccount[]>([]);
  const [loadingGithub, setLoadingGithub] = useState(false);

  // Notification Preferences state
  const [notifFailures, setNotifFailures] = useState(true);
  const [notifSuccesses, setNotifSuccesses] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const fetchGithubAccounts = async () => {
    setLoadingGithub(true);
    try {
      const { data } = await userService.getGithubAccounts();
      setGithubAccounts(data || []);
    } catch (err) {
      console.error('Failed to load GitHub accounts', err);
    } finally {
      setLoadingGithub(false);
    }
  };

  useEffect(() => {
    fetchGithubAccounts();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileSuccess(false);

    try {
      await userService.updateProfile({
        full_name: fullName,
        avatar_url: avatarUrl,
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      console.error('Profile update failed', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setPasswordLoading(true);
    try {
      await authService.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to update password. Verify current password.';
      setPasswordError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      const { data } = await authService.getGithubAuthUrl();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch {
      alert('Could not initiate GitHub authorization');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100">Settings</h1>
        <p className="text-xs font-medium text-dark-400 mt-0.5">
          Manage your account profile, GitHub integrations, and security
        </p>
      </div>

      {/* 1. Profile Section */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-subtle space-y-6">
        <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-4">
          <User className="h-5 w-5 text-primary-600" />
          <h2 className="text-base font-bold text-dark-100">Profile Details</h2>
        </div>

        {profileSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-medium shadow-2xs">
            <Check className="h-4 w-4" />
            <span>Profile successfully updated!</span>
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-lg">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="Avatar Image URL"
            placeholder="https://example.com/avatar.png"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
          <Button type="submit" variant="primary" isLoading={profileLoading}>
            Save Changes
          </Button>
        </form>
      </div>

      {/* 2. Connected GitHub Accounts */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-subtle space-y-6">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-bold text-dark-100">GitHub Integrations</h2>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleConnectGitHub}
            leftIcon={<Github className="h-4 w-4" />}
          >
            Connect Account
          </Button>
        </div>

        {githubAccounts.length === 0 ? (
          <div className="py-6 text-center text-xs text-dark-400 space-y-2 font-medium">
            <p>No GitHub account connected yet.</p>
            <p className="text-dark-400">
              Connect your GitHub account to import repositories and track workflows automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {githubAccounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-slate-50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-bold border border-primary-200">
                    {acc.avatar_url ? (
                      <img
                        src={acc.avatar_url}
                        alt={acc.github_username || acc.username || 'GitHub'}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      (acc.github_username || acc.username || 'G')[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-dark-100">@{acc.github_username || acc.username || 'user'}</p>
                    <p className="text-xs text-dark-400 font-medium">GitHub ID: {acc.github_id ?? acc.id}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <Check className="h-3.5 w-3.5" /> Connected
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Change Password */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-subtle space-y-6">
        <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-4">
          <Shield className="h-5 w-5 text-primary-600" />
          <h2 className="text-base font-bold text-dark-100">Security & Password</h2>
        </div>

        {passwordError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium shadow-2xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-medium shadow-2xs">
            <Check className="h-4 w-4" />
            <span>Password updated successfully!</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
          <Input
            label="Current Password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" isLoading={passwordLoading}>
            Update Password
          </Button>
        </form>
      </div>

      {/* 4. Notification Preferences */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-subtle space-y-6">
        <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-4">
          <Bell className="h-5 w-5 text-primary-600" />
          <h2 className="text-base font-bold text-dark-100">Notification Preferences</h2>
        </div>

        <div className="space-y-4 max-w-lg text-xs">
          <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5E7EB] bg-slate-50/70 hover:bg-slate-100/70 transition-colors cursor-pointer">
            <div>
              <p className="font-bold text-dark-100">Build Failure Alerts</p>
              <p className="text-dark-400 font-medium">Receive alert when any CI/CD workflow pipeline fails</p>
            </div>
            <input
              type="checkbox"
              checked={notifFailures}
              onChange={(e) => setNotifFailures(e.target.checked)}
              className="h-4 w-4 rounded border-[#E5E7EB] text-primary-600 focus:ring-primary-500/20"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5E7EB] bg-slate-50/70 hover:bg-slate-100/70 transition-colors cursor-pointer">
            <div>
              <p className="font-bold text-dark-100">Build Success Alerts</p>
              <p className="text-dark-400 font-medium">Notify upon successful completion of workflow runs</p>
            </div>
            <input
              type="checkbox"
              checked={notifSuccesses}
              onChange={(e) => setNotifSuccesses(e.target.checked)}
              className="h-4 w-4 rounded border-[#E5E7EB] text-primary-600 focus:ring-primary-500/20"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
