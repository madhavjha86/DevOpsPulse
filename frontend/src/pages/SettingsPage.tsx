import React, { useEffect, useState } from 'react';
import {
  User,
  Shield,
  Github,
  Bell,
  Check,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services/users';
import { authService } from '@/services/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();

  // Profile Form state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Form state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // GitHub Account state
  const [githubAccounts, setGithubAccounts] = useState<any[]>([]);

  // Notification Preferences state
  const [notifFailures, setNotifFailures] = useState(true);
  const [notifSuccesses, setNotifSuccesses] = useState(false);
  const [notifCompletion, setNotifCompletion] = useState(true);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setAvatarUrl(user.avatar_url || '');
    }
    const loadGithubAccounts = async () => {
      try {
        const { data } = await userService.getGithubAccounts();
        setGithubAccounts(data || []);
      } catch {
        // Ignore error
      }
    };
    loadGithubAccounts();
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(false);
    setProfileLoading(true);

    try {
      const { data } = await userService.updateProfile({
        full_name: fullName,
        avatar_url: avatarUrl,
      });
      updateUser(data);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update profile', err);
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
      setPasswordError('Password must be at least 8 characters long');
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
      const msg = err.response?.data?.detail || 'Failed to change password.';
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
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Settings</h1>
        <p className="text-xs text-dark-400">
          Manage your account profile, GitHub integrations, and security
        </p>
      </div>

      {/* 1. Profile Section */}
      <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2 border-b border-dark-800 pb-4">
          <User className="h-5 w-5 text-primary-400" />
          <h2 className="text-base font-semibold text-white">Profile Details</h2>
        </div>

        {profileSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-success-500/30 bg-success-500/10 p-3 text-xs text-success-300">
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
      <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-dark-800 pb-4">
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-primary-400" />
            <h2 className="text-base font-semibold text-white">GitHub Integrations</h2>
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
          <div className="py-6 text-center text-xs text-dark-400 space-y-2">
            <p>No GitHub account connected yet.</p>
            <p className="text-dark-500">
              Connect your GitHub account to import repositories and track workflows automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {githubAccounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between rounded-xl border border-dark-800 bg-dark-800/50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-dark-700 text-white font-bold">
                    {acc.avatar_url ? (
                      <img
                        src={acc.avatar_url}
                        alt={acc.github_username}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      acc.github_username[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">@{acc.github_username}</p>
                    <p className="text-xs text-dark-400">GitHub ID: {acc.github_id}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs text-success-400 font-medium">
                  <Check className="h-4 w-4" /> Connected
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Change Password */}
      <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2 border-b border-dark-800 pb-4">
          <Shield className="h-5 w-5 text-primary-400" />
          <h2 className="text-base font-semibold text-white">Security & Password</h2>
        </div>

        {passwordError && (
          <div className="flex items-center gap-2 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-success-500/30 bg-success-500/10 p-3 text-xs text-success-300">
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
      <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2 border-b border-dark-800 pb-4">
          <Bell className="h-5 w-5 text-primary-400" />
          <h2 className="text-base font-semibold text-white">Notification Preferences</h2>
        </div>

        <div className="space-y-4 max-w-lg text-xs">
          <label className="flex items-center justify-between p-3 rounded-lg border border-dark-800 bg-dark-800/40 cursor-pointer">
            <div>
              <p className="font-semibold text-white">Build Failure Alerts</p>
              <p className="text-dark-400">Receive alert when any CI/CD workflow pipeline fails</p>
            </div>
            <input
              type="checkbox"
              checked={notifFailures}
              onChange={(e) => setNotifFailures(e.target.checked)}
              className="h-4 w-4 rounded border-dark-700 bg-dark-900 text-primary-600 focus:ring-primary-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-dark-800 bg-dark-800/40 cursor-pointer">
            <div>
              <p className="font-semibold text-white">Build Success Alerts</p>
              <p className="text-dark-400">Notify upon successful completion of workflow runs</p>
            </div>
            <input
              type="checkbox"
              checked={notifSuccesses}
              onChange={(e) => setNotifSuccesses(e.target.checked)}
              className="h-4 w-4 rounded border-dark-700 bg-dark-900 text-primary-600 focus:ring-primary-500"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
