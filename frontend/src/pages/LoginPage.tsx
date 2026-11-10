import React from 'react';
import { Activity } from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';
import { AnimatedBackground } from '@/components/layout/AnimatedBackground';

export const LoginPage: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12 relative overflow-hidden">
      {/* Decorative ambient background waves */}
      <AnimatedBackground />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25">
            <Activity className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-dark-100">Welcome back</h1>
          <p className="mt-1 text-xs font-medium text-dark-400">
            Sign in to DevOpsPulse to monitor your CI/CD pipelines
          </p>
        </div>

        {/* Form Card (Responsive padding: p-5 on mobile, p-8 on desktop) */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-8 shadow-card-hover">
          <LoginForm />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
