import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-5">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-black text-slate-900 tracking-tight">Something went wrong</h2>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              An unexpected client error occurred. The application state has been preserved safely.
            </p>

            {this.state.error && (
              <div className="mt-4 rounded-xl bg-slate-100 p-3 text-left overflow-x-auto text-[11px] font-mono text-slate-700 max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="primary"
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 text-xs py-2.5 px-4"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reload Page
              </Button>
              <Button
                variant="secondary"
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 text-xs py-2.5 px-4"
              >
                <Home className="h-3.5 w-3.5" />
                Go to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
