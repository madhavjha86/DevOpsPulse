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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-sm">
              <TerminalIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  In-Browser Web Terminal
                </h1>
                <Badge variant="success">Zero-Latency Shell</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Secure, audited shell execution directly into Kubernetes pods, Docker containers, and control nodes.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-xl border border-slate-200 bg-slate-100/70 p-1">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'terminal'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
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
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'audit'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
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
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-subtle">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Target Environment:
              </label>
              <select
                value={selectedTarget?.id}
                onChange={(e) => {
                  const found = targets.find((t) => t.id === e.target.value);
                  if (found) setSelectedTarget(found);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.type.toUpperCase()}] {t.name}
                  </option>
                ))}
              </select>
              {selectedTarget && (
                <span className="hidden text-xs text-slate-500 font-medium md:inline">
                  {selectedTarget.details}
                </span>
              )}
            </div>

            {/* Quick Command Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Quick Commands:</span>
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExecute(chip)}
                  disabled={executing}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 transition hover:border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  {chip.split(' ')[0]} {chip.split(' ')[1]}
                </button>
              ))}
            </div>
          </div>

          {/* Terminal Window */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0F172A] shadow-2xl">
            {/* Terminal Window Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500/90" />
                <span className="h-3 w-3 rounded-full bg-amber-500/90" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/90" />
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
              <div className="text-xs text-emerald-400 mb-3 font-semibold">
                === DevOpsPulse Secure Remote Terminal Session Initialized ===<br />
                Type shell commands below. Press [Enter] to execute. Press [Up/Down] for history.
              </div>

              {terminalLogs.map((log) => (
                <div key={log.id} className="mb-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="text-emerald-400 font-bold">
                      devops@{log.targetName}:~$ <span className="text-slate-100 font-normal">{log.command}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={log.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        exit: {log.exitCode}
                      </span>
                      <span>{log.durationMs}ms</span>
                    </span>
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-black/60 p-2.5 text-xs text-slate-200 border border-slate-900 font-mono">
                    {log.output}
                  </pre>
                </div>
              ))}

              <div ref={terminalEndRef} />
            </div>

            {/* Command Input Bar */}
            <div className="flex items-center gap-2 border-t border-slate-800 bg-black/90 px-4 py-3">
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
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
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
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 shadow-2xs">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-950">Zero-Trust Guardrails Active: </span>
              Destructive patterns such as recursive root deletion (`rm -rf /`), fork bombs, raw block disk overwrites, and unauthorized host escapes are automatically blocked and logged to the central security audit trail.
            </div>
          </div>
        </div>
      ) : (
        /* Audit Logs View */
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-subtle">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Command Execution Audit History</h2>
            <Button size="sm" variant="secondary" onClick={fetchAuditLogs}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              No remote commands executed in this session yet. Run a command in the terminal to inspect audit logs.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Session</th>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Target</th>
                    <th className="py-2.5 px-3">Command</th>
                    <th className="py-2.5 px-3">Exit Code</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {auditLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-mono text-emerald-700 font-bold">{log.session_id}</td>
                      <td className="py-2.5 px-3 text-slate-700">{log.user_email}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="neutral">{log.target_type}</Badge> <span className="font-mono text-slate-700">{log.target_id}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{log.command}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant={log.exit_code === 0 ? 'success' : 'danger'}>
                          {log.exit_code}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{log.duration_ms}ms</td>
                      <td className="py-2.5 px-3 text-slate-500">
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
