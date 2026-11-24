import React, { useEffect, useState, useRef } from 'react';
import {
  Terminal as TerminalIcon,
  Server,
  Play,
  RotateCw,
  Copy,
  Check,
  Trash2,
  ShieldAlert,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  terminalApi,
  TerminalExecRequest,
  TerminalExecResponse,
  TerminalTargetItem,
} from '../services/terminal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function WebTerminalPage() {
  const [targets, setTargets] = useState<TerminalTargetItem[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<TerminalTargetItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [terminalLogs, setTerminalLogs] = useState<
    Array<{
      id: string;
      command: string;
      output: string;
      exitCode: number;
      durationMs: number;
      targetName: string;
      timestamp: string;
    }>
  >([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'audit'>('terminal');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTargets();
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const data = await terminalApi.getTargets();
      setTargets(data);
      if (data.length > 0) {
        setSelectedTarget(data[0]);
      }
    } catch (err) {
      console.error('Failed to load terminal targets', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const logs = await terminalApi.getHistory(50);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    }
  };

  const handleExecute = async (cmdToRun?: string) => {
    const rawCmd = (cmdToRun || command).trim();
    if (!rawCmd || !selectedTarget || executing) return;

    setExecuting(true);
    setCommandHistory((prev) => [...prev, rawCmd]);
    setHistoryIndex(-1);

    try {
      const req: TerminalExecRequest = {
        target_type: selectedTarget.type,
        target_id: selectedTarget.id,
        command: rawCmd,
        namespace: selectedTarget.namespace,
      };

      const res: TerminalExecResponse = await terminalApi.executeCommand(req);

      setTerminalLogs((prev) => [
        ...prev,
        {
          id: res.session_id,
          command: rawCmd,
          output: res.output,
          exitCode: res.exit_code,
          durationMs: res.duration_ms,
          targetName: selectedTarget.name,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setCommand('');
    } catch (err: any) {
      setTerminalLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          command: rawCmd,
          output: err?.response?.data?.detail || err.message || 'Execution failed',
          exitCode: 1,
          durationMs: 0,
          targetName: selectedTarget.name,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExecute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const nextIdx = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setCommand(commandHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const nextIdx = historyIndex + 1;
        if (nextIdx >= commandHistory.length) {
          setHistoryIndex(-1);
          setCommand('');
        } else {
          setHistoryIndex(nextIdx);
          setCommand(commandHistory[nextIdx]);
        }
      }
    }
  };

  const handleCopyLogs = () => {
    const fullText = terminalLogs.map((l) => `$ ${l.command}\n${l.output}`).join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickChips = [
    'kubectl get pods -n production',
    'kubectl top nodes',
    'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
    'netstat -tuln',
    'uptime',
    'df -h',
  ];

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Context Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <TerminalIcon className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100">In-Browser Web Terminal</h1>
            <Badge variant="success">Zero-Latency Shell</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Secure, audited shell execution directly into Kubernetes pods, Docker containers, and control nodes.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-lg border border-slate-800 bg-slate-900/80 p-1">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'terminal'
                ? 'bg-emerald-500/20 text-emerald-400 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TerminalIcon className="h-3.5 w-3.5" />
            Interactive Shell
          </button>
          <button
            onClick={() => {
              setActiveTab('audit');
              fetchAuditLogs();
            }}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'audit'
                ? 'bg-indigo-500/20 text-indigo-400 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Security Audit Logs
          </button>
        </div>
      </div>

      {activeTab === 'terminal' ? (
        <div className="space-y-4">
          {/* Target Selector & Quick Chips Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Target Environment:
              </label>
              <select
                value={selectedTarget?.id}
                onChange={(e) => {
                  const found = targets.find((t) => t.id === e.target.value);
                  if (found) setSelectedTarget(found);
                }}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.type.toUpperCase()}] {t.name}
                  </option>
                ))}
              </select>
              {selectedTarget && (
                <span className="hidden text-xs text-slate-400 md:inline">
                  {selectedTarget.details}
                </span>
              )}
            </div>

            {/* Quick Command Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Quick Commands:</span>
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExecute(chip)}
                  disabled={executing}
                  className="rounded-md border border-slate-700/60 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 transition hover:border-emerald-500/50 hover:bg-slate-700 hover:text-emerald-300"
                >
                  {chip.split(' ')[0]} {chip.split(' ')[1]}
                </button>
              ))}
            </div>
          </div>

          {/* Terminal Window */}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-black/90 shadow-2xl">
            {/* Terminal Window Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-xs text-slate-400">
                  {selectedTarget ? `${selectedTarget.id} (${selectedTarget.type})` : 'bash'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLogs}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                  title="Copy terminal session"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => setTerminalLogs([])}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
                  title="Clear screen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            </div>

            {/* Terminal Output Area */}
            <div className="h-[460px] overflow-y-auto p-4 font-mono text-sm leading-relaxed text-slate-200">
              <div className="text-xs text-emerald-400/80 mb-3">
                === DevOpsPulse Secure Remote Terminal Session Initialized ===<br />
                Type shell commands below. Press [Enter] to execute. Press [Up/Down] for history.
              </div>

              {terminalLogs.map((log) => (
                <div key={log.id} className="mb-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="text-emerald-400 font-semibold">
                      devops@{log.targetName}:~$ <span className="text-slate-100">{log.command}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={log.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        exit: {log.exitCode}
                      </span>
                      <span>{log.durationMs}ms</span>
                    </span>
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-950/60 p-2 text-xs text-slate-300 border border-slate-900 font-mono">
                    {log.output}
                  </pre>
                </div>
              ))}

              <div ref={terminalEndRef} />
            </div>

            {/* Command Input Bar */}
            <div className="flex items-center gap-2 border-t border-slate-800 bg-slate-950 px-4 py-3">
              <span className="font-mono text-sm font-bold text-emerald-400">$</span>
              <input
                ref={inputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter command (e.g. kubectl get pods, docker stats, free -m)..."
                disabled={executing}
                className="flex-1 bg-transparent font-mono text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
                autoFocus
              />
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleExecute()}
                disabled={executing || !command.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {executing ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Run
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Safety Notice */}
          <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 text-xs text-slate-400">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">Zero-Trust Guardrails Active: </span>
              Destructive patterns such as recursive root deletion (`rm -rf /`), fork bombs, raw block disk overwrites, and unauthorized host escapes are automatically blocked and logged to the central security audit trail.
            </div>
          </div>
        </div>
      ) : (
        /* Audit Logs View */
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Command Execution Audit History</h2>
            <Button size="sm" variant="secondary" onClick={fetchAuditLogs}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No remote commands executed in this session yet. Run a command in the terminal to inspect audit logs.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Session</th>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Target</th>
                    <th className="py-2.5 px-3">Command</th>
                    <th className="py-2.5 px-3">Exit Code</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono text-emerald-400">{log.session_id}</td>
                      <td className="py-2.5 px-3 text-slate-300">{log.user_email}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="neutral">{log.target_type}</Badge> {log.target_id}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">{log.command}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant={log.exit_code === 0 ? 'success' : 'danger'}>
                          {log.exit_code}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{log.duration_ms}ms</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
