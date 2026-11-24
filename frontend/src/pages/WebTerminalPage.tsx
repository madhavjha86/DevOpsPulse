import React, { useEffect, useState, useRef } from 'react';
import {
  Terminal as TerminalIcon,
  RotateCw,
  Copy,
  Check,
  Trash2,
  ShieldAlert,
  Clock,
  Maximize2,
  Minimize2,
  Palette,
  HelpCircle,
  CornerDownLeft,
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

interface TerminalLine {
  id: string;
  type: 'prompt-cmd' | 'stdout' | 'stderr' | 'system';
  prompt?: string;
  text: string;
  exitCode?: number;
  durationMs?: number;
  timestamp?: string;
}

type TerminalTheme = 'modern' | 'matrix' | 'amber';

const KNOWN_COMMANDS = [
  'kubectl get pods -n production',
  'kubectl top nodes',
  'docker ps',
  'netstat -tuln',
  'uptime',
  'df -h',
  'free -m',
  'ls -l',
  'tree',
  'clear',
  'help',
  'history',
  'whoami',
  'uname -a',
];

export default function WebTerminalPage() {
  const [targets, setTargets] = useState<TerminalTargetItem[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<TerminalTargetItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'audit'>('terminal');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState<TerminalTheme>('modern');

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTargets();
  }, []);

  useEffect(() => {
    if (selectedTarget && lines.length === 0) {
      initWelcomeBanner(selectedTarget);
    }
  }, [selectedTarget]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, command]);

  const initWelcomeBanner = (target: TerminalTargetItem) => {
    setLines([
      {
        id: 'banner-1',
        type: 'system',
        text: 'Linux devopspulse-worker-01 6.5.0-generic x86_64 • DevOpsPulse Secure Remote PTY',
      },
      {
        id: 'banner-2',
        type: 'system',
        text: `Connected to [${target.type.toUpperCase()}] ${target.id} (${target.details || 'Ready'})`,
      },
      {
        id: 'banner-3',
        type: 'system',
        text: "Type 'help' for built-ins, 'clear' (or Ctrl+L) to wipe screen. Press [Tab] to autocomplete.",
      },
      {
        id: 'banner-4',
        type: 'system',
        text: '----------------------------------------------------------------------------------',
      },
    ]);
  };

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

  const getPromptText = () => {
    const host = selectedTarget ? selectedTarget.name.split(' ')[0].toLowerCase() : 'target';
    return `devops@${host}:~$ `;
  };

  const executeLine = async (rawCmdToRun?: string) => {
    const rawCmd = (rawCmdToRun !== undefined ? rawCmdToRun : command).trim();
    if (!rawCmd || !selectedTarget || executing) return;

    setExecuting(true);
    setCommandHistory((prev) => [...prev, rawCmd]);
    setHistoryIndex(-1);

    const promptText = getPromptText();
    const promptEntryId = Math.random().toString(36).substring(7);

    // 1. Immediately print the command prompt line in continuous flow
    setLines((prev) => [
      ...prev,
      {
        id: promptEntryId,
        type: 'prompt-cmd',
        prompt: promptText,
        text: rawCmd,
      },
    ]);
    setCommand('');

    // Handle Client-Side Builtins
    const lower = rawCmd.toLowerCase();
    if (lower === 'clear' || lower === 'cls') {
      setLines([]);
      setExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    if (lower === 'help') {
      const helpText = [
        'DevOpsPulse Interactive Remote Shell Builtins & Diagnostic Utilities:',
        '  • kubectl get pods -n production  : List all production Kubernetes pods',
        '  • kubectl top nodes               : Check CPU and Memory consumption per node',
        '  • docker ps                       : List live running Docker containers',
        '  • uptime / w                      : Display system load average and active uptime',
        '  • df -h                           : Inspect mounted disk partition usage',
        '  • free -m                         : Inspect system memory (RAM & Swap)',
        '  • netstat -tuln                   : List active listening network ports',
        '  • history                         : Display executed command sequence',
        '  • clear / cls (or Ctrl+L)         : Clear terminal viewport buffer',
        '',
        'Interactive Shortcuts:',
        '  [Tab] Autocomplete command | [↑/↓] Traverse command history | [Ctrl+C] Abort input',
      ].join('\n');

      setLines((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          type: 'system',
          text: helpText,
        },
      ]);
      setExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    if (lower === 'history') {
      const histText = commandHistory.map((c, i) => `  ${(i + 1).toString().padStart(3, ' ')}  ${c}`).join('\n') || '  (No previous commands recorded)';
      setLines((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          type: 'system',
          text: histText,
        },
      ]);
      setExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    // Call Backend Remote Dispatch
    try {
      const req: TerminalExecRequest = {
        target_type: selectedTarget.type,
        target_id: selectedTarget.id,
        command: rawCmd,
        namespace: selectedTarget.namespace,
      };

      const res: TerminalExecResponse = await terminalApi.executeCommand(req);

      setLines((prev) => [
        ...prev,
        {
          id: res.session_id,
          type: res.exit_code === 0 ? 'stdout' : 'stderr',
          text: res.output.trimEnd(),
          exitCode: res.exit_code,
          durationMs: res.duration_ms,
        },
      ]);
    } catch (err: any) {
      setLines((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          type: 'stderr',
          text: `bash: ${err?.response?.data?.detail || err.message || 'command execution failed'}`,
          exitCode: 1,
        },
      ]);
    } finally {
      setExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+L to clear screen
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setLines([]);
      return;
    }

    // Ctrl+C to cancel current line
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      const promptText = getPromptText();
      setLines((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          type: 'prompt-cmd',
          prompt: promptText,
          text: command + '^C',
        },
      ]);
      setCommand('');
      return;
    }

    // Enter to execute
    if (e.key === 'Enter') {
      e.preventDefault();
      executeLine();
      return;
    }

    // Tab for Autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      const val = command.trim().toLowerCase();
      if (!val) return;
      const matched = KNOWN_COMMANDS.find((k) => k.startsWith(val));
      if (matched) {
        setCommand(matched);
      }
      return;
    }

    // Up Arrow: History Previous
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const nextIdx = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setCommand(commandHistory[nextIdx]);
      }
      return;
    }

    // Down Arrow: History Next
    if (e.key === 'ArrowDown') {
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
      return;
    }
  };

  const handleCopyAll = () => {
    const fullText = lines
      .map((l) => (l.type === 'prompt-cmd' ? `${l.prompt}${l.text}` : l.text))
      .join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickChips = [
    'kubectl get pods -n production',
    'docker ps',
    'ls -l',
    'tree',
    'uptime',
    'df -h',
    'help',
  ];

  // Theme configuration
  const themeClasses = {
    modern: {
      bg: 'bg-[#0B0F19]',
      text: 'text-slate-200',
      prompt: 'text-emerald-400 font-bold',
      system: 'text-slate-500 font-semibold',
      stdout: 'text-slate-100',
      stderr: 'text-rose-400 font-semibold',
      header: 'bg-[#111827] border-slate-800 text-slate-300',
    },
    matrix: {
      bg: 'bg-black',
      text: 'text-green-500',
      prompt: 'text-green-400 font-bold',
      system: 'text-green-700 font-semibold',
      stdout: 'text-green-400',
      stderr: 'text-red-500 font-bold',
      header: 'bg-zinc-950 border-green-900/40 text-green-400',
    },
    amber: {
      bg: 'bg-[#0d0903]',
      text: 'text-amber-400',
      prompt: 'text-amber-300 font-bold',
      system: 'text-amber-700 font-semibold',
      stdout: 'text-amber-300',
      stderr: 'text-red-400 font-bold',
      header: 'bg-[#181105] border-amber-900/40 text-amber-300',
    },
  }[theme];

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#0B0F19] p-4 flex flex-col' : ''}`}>
      {/* Top Header & Navigation (Hidden in fullscreen if desired, or simplified) */}
      {!isFullscreen && (
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
                  <Badge variant="success">Interactive Real Shell</Badge>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  Direct, zero-trust audited PTY terminal into Kubernetes pods, Docker containers, and cloud nodes.
                </p>
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
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
              Live Terminal
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
      )}

      {activeTab === 'terminal' ? (
        <div className={`space-y-3 ${isFullscreen ? 'flex-1 flex flex-col' : ''}`}>
          {/* Target Selector & Quick Actions Toolbar */}
          {!isFullscreen && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-subtle">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Target:
                </span>
                <select
                  value={selectedTarget?.id}
                  onChange={(e) => {
                    const found = targets.find((t) => t.id === e.target.value);
                    if (found) {
                      setSelectedTarget(found);
                      initWelcomeBanner(found);
                    }
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.type.toUpperCase()}] {t.name}
                    </option>
                  ))}
                </select>
                {selectedTarget && (
                  <span className="hidden text-xs text-slate-500 font-medium lg:inline">
                    • {selectedTarget.details}
                  </span>
                )}
              </div>

              {/* Quick Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400 mr-1">Quick Run:</span>
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => executeLine(chip)}
                    disabled={executing}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 transition hover:border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* REAL CONTINUOUS TERMINAL WINDOW */}
          <div
            onClick={() => inputRef.current?.focus()}
            className={`flex-1 flex flex-col cursor-text overflow-hidden rounded-2xl border shadow-2xl transition-all ${
              themeClasses.bg
            } ${isFullscreen ? 'h-full border-slate-800' : 'h-[580px] border-slate-800'}`}
          >
            {/* Terminal Window Chrome / Titlebar */}
            <div
              className={`flex items-center justify-between border-b px-4 py-2.5 select-none ${themeClasses.header}`}
            >
              {/* macOS Style Window Dots */}
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500/90 shadow-xs" />
                <span className="h-3 w-3 rounded-full bg-amber-500/90 shadow-xs" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/90 shadow-xs" />
                <span className="ml-2 font-mono text-xs font-semibold opacity-80">
                  {selectedTarget ? `${selectedTarget.name} (${selectedTarget.id})` : 'bash'}
                </span>
              </div>

              {/* Window Tools & Controls */}
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {/* Theme Selector */}
                <div className="flex items-center gap-1 text-xs border border-slate-700/60 rounded-lg p-0.5">
                  <button
                    onClick={() => setTheme('modern')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                      theme === 'modern' ? 'bg-slate-700 text-white font-bold' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setTheme('matrix')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                      theme === 'matrix' ? 'bg-green-950 text-green-400 font-bold' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    Matrix
                  </button>
                  <button
                    onClick={() => setTheme('amber')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                      theme === 'amber' ? 'bg-amber-950 text-amber-400 font-bold' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    Amber
                  </button>
                </div>

                {/* Copy Screen */}
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs opacity-70 transition hover:bg-white/10 hover:opacity-100"
                  title="Copy terminal contents"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                </button>

                {/* Clear Screen */}
                <button
                  onClick={() => setLines([])}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs opacity-70 transition hover:bg-rose-500/20 hover:text-rose-400 hover:opacity-100"
                  title="Clear screen (or type 'clear')"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>

                {/* Fullscreen Toggle */}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs opacity-70 transition hover:bg-white/10 hover:opacity-100"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Terminal'}
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Continuous Terminal Buffer Viewport */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed space-y-1">
              {/* Printed Stream */}
              {lines.map((line) => {
                if (line.type === 'system') {
                  return (
                    <div key={line.id} className={`${themeClasses.system} text-xs py-0.5 select-text`}>
                      <pre className="font-mono whitespace-pre-wrap">{line.text}</pre>
                    </div>
                  );
                }

                if (line.type === 'prompt-cmd') {
                  return (
                    <div key={line.id} className="flex items-center gap-1.5 pt-1.5 select-text">
                      <span className={themeClasses.prompt}>{line.prompt}</span>
                      <span className="font-bold text-white tracking-wide">{line.text}</span>
                    </div>
                  );
                }

                if (line.type === 'stdout') {
                  const formatStdout = (rawText: string) => {
                    const textLines = rawText.split('\n');
                    return textLines.map((tLine, idx) => {
                      if (tLine.startsWith('drwx') || tLine.includes('/')) {
                        return (
                          <span key={idx} className="block">
                            {tLine.split(/(\b[\w.-]+\/)/g).map((part, pIdx) =>
                              part.endsWith('/') ? (
                                <span key={pIdx} className="text-cyan-400 font-bold">
                                  {part}
                                </span>
                              ) : (
                                part
                              )
                            )}
                          </span>
                        );
                      }
                      return <span key={idx} className="block">{tLine}</span>;
                    });
                  };

                  return (
                    <div key={line.id} className={`${themeClasses.stdout} pb-1.5 select-text`}>
                      <pre className="font-mono whitespace-pre-wrap leading-tight">
                        {formatStdout(line.text)}
                      </pre>
                      {line.durationMs !== undefined && (
                        <div className="text-[10px] opacity-40 text-right mt-0.5">
                          ✓ {line.durationMs}ms • exit 0
                        </div>
                      )}
                    </div>
                  );
                }

                if (line.type === 'stderr') {
                  return (
                    <div key={line.id} className={`${themeClasses.stderr} pb-1.5 select-text`}>
                      <pre className="font-mono whitespace-pre-wrap leading-tight">{line.text}</pre>
                      {line.exitCode !== undefined && (
                        <div className="text-[10px] text-rose-500 opacity-80 mt-0.5">
                          exit code: {line.exitCode}
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              })}

              {/* ACTIVE INLINE PROMPT LINE */}
              <div className="flex items-center font-mono text-sm pt-1">
                <span className={themeClasses.prompt}>{getPromptText()}</span>
                <div className="relative flex-1 flex items-center ml-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={executing}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    className="w-full bg-transparent font-mono text-sm text-slate-100 focus:outline-none border-none p-0 caret-emerald-400 font-bold"
                    autoFocus
                  />
                  {executing && (
                    <span className="ml-2 text-xs text-amber-400 font-mono animate-pulse">
                      [running...]
                    </span>
                  )}
                </div>
              </div>

              <div ref={terminalEndRef} />
            </div>

            {/* Bottom Status Ribbon */}
            <div className="border-t border-slate-800/80 bg-black/60 px-4 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-500 select-none">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  ONLINE PTY
                </span>
                <span className="hidden sm:inline text-slate-400">
                  Target: {selectedTarget?.id}
                </span>
              </div>
              <div className="flex items-center gap-3 text-slate-400">
                <span>[Tab] autocomplete</span>
                <span>[↑/↓] history</span>
                <span>Ctrl+L clear</span>
                {isFullscreen && <span>Esc / Maximize to exit</span>}
              </div>
            </div>
          </div>

          {/* Zero-Trust Notice */}
          {!isFullscreen && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 shadow-2xs">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-950">Zero-Trust Guardrails Active: </span>
                Destructive operations like recursive root wipes (`rm -rf /`), fork bombs, and raw disk overwrites are proactively blocked and recorded to the security audit log.
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Security Audit Logs Tab */
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-subtle">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Security Audit Logs & Compliance Trail</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every remote command executed across pods and containers is permanently recorded with full session attribution.
              </p>
            </div>
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
                        <Badge variant="neutral">{log.target_type}</Badge>{' '}
                        <span className="font-mono text-slate-700">{log.target_id}</span>
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
