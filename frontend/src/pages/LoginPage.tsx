import React from 'react';
import { Activity } from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';

export const LoginPage: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dark-950 px-4 py-12 relative overflow-hidden">
      {/* Decorative gradient glowing orbs */}
      <div className="absolute top-1/4 -left-32 h-96 w-96 rounded-full bg-primary-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 h-96 w-96 rounded-full bg-primary-800/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-600 to-primary-400 text-white shadow-xl shadow-primary-600/30">
            <Activity className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
          <p className="mt-1 text-xs text-dark-400">
            Sign in to DevOpsPulse to monitor your CI/CD pipelines
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-dark-800 bg-dark-900/90 p-8 shadow-2xl backdrop-blur-xl">
          <LoginForm />
        </div>
      </div>
    </div>
  );
};
