import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Layers,
  RefreshCw,
  Search,
  Terminal,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  telemetryService,
  TelemetryLog,
  TelemetrySpan,
  TelemetryStats,
  TelemetryTraceDetailResponse,
  TelemetryTraceSummary,
} from '../services/telemetry';

export const TelemetryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'logs' | 'traces'>('logs');
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Traces state
  const [traces, setTraces] = useState<TelemetryTraceSummary[]>([]);
  const [tracesLoading, setTracesLoading] = useState(false);
  const [traceServiceFilter, setTraceServiceFilter] = useState('all');
  const [errorOnlyFilter, setErrorOnlyFilter] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceDetail, setTraceDetail] = useState<TelemetryTraceDetailResponse | null>(null);
  const [traceDetailLoading, setTraceDetailLoading] = useState(false);

  // Initial stats and services fetch
  const fetchMetadata = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [sData, svcList] = await Promise.all([
        telemetryService.getStats(),
        telemetryService.getServices(),
      ]);
      if (sData && typeof sData === 'object' && 'total_logs_24h' in sData) {
        setStats(sData);
      }
      if (Array.isArray(svcList)) {
        setServices(svcList);
      }
    } catch (err) {
      console.error('Failed to load telemetry metadata', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await telemetryService.getLogs({
        service_name: selectedService !== 'all' ? selectedService : undefined,
        level: selectedLevel !== 'all' ? selectedLevel : undefined,
        search: logSearch.trim() || undefined,
        limit: 50,
      });
      if (res && Array.isArray(res.logs)) {
        setLogs(res.logs);
        setTotalLogs(res.total ?? 0);
      }
    } catch (err) {
      console.error('Failed to load logs', err);
    } finally {
      setLogsLoading(false);
    }
  }, [selectedService, selectedLevel, logSearch]);

  // Fetch traces
  const fetchTraces = useCallback(async () => {
    setTracesLoading(true);
    try {
      const res = await telemetryService.getTraces({
        service_name: traceServiceFilter !== 'all' ? traceServiceFilter : undefined,
        has_error: errorOnlyFilter ? true : undefined,
        limit: 30,
      });
      if (Array.isArray(res)) {
        setTraces(res);
        if (res.length > 0 && !selectedTraceId) {
          setSelectedTraceId(res[0].trace_id);
        }
      }
    } catch (err) {
      console.error('Failed to load traces', err);
    } finally {
      setTracesLoading(false);
    }
  }, [traceServiceFilter, errorOnlyFilter, selectedTraceId]);

  // Fetch trace waterfall detail
  const fetchTraceDetail = useCallback(async (tid: string) => {
    setTraceDetailLoading(true);
    try {
      const detail = await telemetryService.getTraceDetail(tid);
      setTraceDetail(detail);
    } catch (err) {
      console.error('Failed to load trace waterfall', err);
    } finally {
      setTraceDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    } else {
      fetchTraces();
    }
  }, [activeTab, fetchLogs, fetchTraces]);

  useEffect(() => {
    if (selectedTraceId) {
      fetchTraceDetail(selectedTraceId);
    }
  }, [selectedTraceId, fetchTraceDetail]);

  const handleTraceClickFromLog = (tid: string) => {
    setSelectedTraceId(tid);
    setActiveTab('traces');
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'ERROR':
      case 'FATAL':
        return <Badge variant="danger">{level}</Badge>;
      case 'WARN':
        return <Badge variant="warning">{level}</Badge>;
      case 'DEBUG':
        return <Badge variant="neutral">{level}</Badge>;
      default:
        return <Badge variant="info">{level}</Badge>;
    }
  };

  // Build span hierarchy depth map for waterfall rendering
  const spanHierarchy = useMemo(() => {
    if (!traceDetail || !traceDetail.spans.length) return [];
    const spanMap = new Map<string, TelemetrySpan>();
    traceDetail.spans.forEach((s) => spanMap.set(s.span_id, s));

    const computeDepth = (span: TelemetrySpan, currentDepth = 0): number => {
      if (!span.parent_span_id || !spanMap.has(span.parent_span_id)) {
        return currentDepth;
      }
      return computeDepth(spanMap.get(span.parent_span_id)!, currentDepth + 1);
    };

    return traceDetail.spans.map((span) => {
      const depth = computeDepth(span);
      const totalDuration = Math.max(traceDetail.duration_ms, 1);
      const widthPct = Math.max((span.duration_ms / totalDuration) * 100, 4);

      // Relative offset from trace root start
      const rootStart = new Date(traceDetail.spans[0].start_time).getTime();
      const thisStart = new Date(span.start_time).getTime();
      const offsetMs = Math.max(thisStart - rootStart, 0);
      const leftPct = Math.min((offsetMs / totalDuration) * 100, 95);

      return {
        span,
        depth,
        widthPct,
        leftPct,
      };
    });
  }, [traceDetail]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary-500" />
            Logs &amp; Distributed Tracing
          </h1>
          <p className="text-sm text-dark-400 mt-1">
            Centralized microservice log streams, full-text search, and end-to-end OpenTelemetry trace waterfalls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              fetchMetadata();
              if (activeTab === 'logs') fetchLogs();
              else fetchTraces();
            }}
            isLoading={loadingStats || logsLoading || tracesLoading}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Observability Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-dark-400 mb-2">
            <span className="text-xs uppercase font-semibold">24h Log Volume</span>
            <Terminal className="h-5 w-5 text-primary-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {stats?.total_logs_24h != null ? stats.total_logs_24h.toLocaleString() : '0'}
          </div>
          <p className="text-xs text-dark-400 mt-1">Collected across active services</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-dark-400 mb-2">
            <span className="text-xs uppercase font-semibold">Error Logs (24h)</span>
            <AlertCircle className="h-5 w-5 text-danger-400" />
          </div>
          <div className="text-2xl font-bold text-danger-400">
            {stats?.error_logs_24h != null ? stats.error_logs_24h.toLocaleString() : '0'}
          </div>
          <p className="text-xs text-dark-400 mt-1">Exceptions &amp; fatal warnings</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-dark-400 mb-2">
            <span className="text-xs uppercase font-semibold">Distributed Traces</span>
            <Layers className="h-5 w-5 text-secondary-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {stats?.total_traces_24h != null ? stats.total_traces_24h.toLocaleString() : '0'}
          </div>
          <p className="text-xs text-dark-400 mt-1">Spans processed</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-dark-400 mb-2">
            <span className="text-xs uppercase font-semibold">p95 Trace Latency</span>
            <Clock className="h-5 w-5 text-warning-400" />
          </div>
          <div className="text-2xl font-bold text-warning-300">
            {stats?.p95_latency_ms != null ? `${stats.p95_latency_ms.toFixed(1)} ms` : '0.0 ms'}
          </div>
          <p className="text-xs text-dark-400 mt-1">95th percentile service duration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-700 space-x-6">
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-dark-400 hover:text-dark-200'
          }`}
        >
          <Terminal className="h-4 w-4" />
          Structured Logs Explorer
        </button>
        <button
          onClick={() => setActiveTab('traces')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'traces'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-dark-400 hover:text-dark-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          Distributed Traces Waterfall
        </button>
      </div>

      {/* TAB 1: Structured Logs Explorer */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="glass-card p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
              <Input
                placeholder="Search log messages, exception text, or endpoints..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Filter by Microservice"
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="bg-dark-900 text-white text-xs rounded-lg border border-dark-700 px-3 py-2"
              >
                <option value="all">All Services ({services.length})</option>
                {services.map((svc) => (
                  <option key={svc} value={svc}>
                    {svc}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Log Level"
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="bg-dark-900 text-white text-xs rounded-lg border border-dark-700 px-3 py-2"
              >
                <option value="all">All Levels</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="DEBUG">DEBUG</option>
              </select>

              <Button variant="secondary" size="sm" onClick={fetchLogs} isLoading={logsLoading}>
                Filter
              </Button>
            </div>
          </div>

          {/* Log Stream Table */}
          <div className="glass-card overflow-hidden">
            <div className="p-3 bg-dark-900/60 border-b border-dark-700/60 flex items-center justify-between text-xs text-dark-400">
              <span>Showing {logs.length} of {totalLogs} events</span>
              <span className="font-mono text-[11px]">Format: ISO UTC • OpenTelemetry</span>
            </div>

            {logsLoading ? (
              <div className="p-12 text-center text-dark-400 text-sm">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary-400" />
                Querying structured logs...
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-dark-400 text-sm">
                No logs match your filter criteria.
              </div>
            ) : (
              <div className="divide-y divide-dark-800/80 font-mono text-xs">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const hasAttrs = Object.keys(log.attributes).length > 0;
                  return (
                    <div
                      key={log.id}
                      className="hover:bg-dark-800/50 transition-colors p-3.5 space-y-2"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-dark-500 text-[11px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          {getLevelBadge(log.level)}
                          <span className="px-2 py-0.5 rounded bg-dark-800 border border-dark-700 text-primary-300 text-[11px] font-sans font-medium">
                            {log.service_name}
                          </span>
                          {log.trace_id && (
                            <button
                              onClick={() => handleTraceClickFromLog(log.trace_id!)}
                              className="text-secondary-400 hover:text-secondary-300 underline text-[11px] flex items-center gap-1"
                              title="Jump to Distributed Trace Waterfall"
                            >
                              <Layers className="h-3 w-3" />
                              {log.trace_id.slice(0, 14)}...
                            </button>
                          )}
                        </div>

                        {hasAttrs && (
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="text-dark-400 hover:text-white flex items-center gap-1 text-[11px] self-start md:self-auto font-sans"
                          >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            {isExpanded ? 'Hide' : 'Details'} ({Object.keys(log.attributes).length} tags)
                          </button>
                        )}
                      </div>

                      <p
                        className={`text-dark-200 break-words leading-relaxed ${
                          log.level === 'ERROR' || log.level === 'FATAL'
                            ? 'text-danger-300'
                            : log.level === 'WARN'
                            ? 'text-warning-200'
                            : 'text-dark-200'
                        }`}
                      >
                        {log.message}
                      </p>

                      {isExpanded && hasAttrs && (
                        <div className="mt-2 p-3 bg-dark-950/80 rounded border border-dark-800 text-[11px] space-y-1">
                          <span className="text-dark-400 font-sans font-semibold uppercase text-[10px] tracking-wider block mb-1">
                            Structured Attributes / Metadata
                          </span>
                          <pre className="text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(log.attributes, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Distributed Traces Waterfall */}
      {activeTab === 'traces' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Trace List (4 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card p-3 flex flex-wrap items-center justify-between gap-2">
              <select
                aria-label="Filter Traces by Service"
                value={traceServiceFilter}
                onChange={(e) => setTraceServiceFilter(e.target.value)}
                className="bg-dark-900 text-white text-xs rounded border border-dark-700 px-2.5 py-1.5"
              >
                <option value="all">All Services</option>
                {services.map((svc) => (
                  <option key={svc} value={svc}>
                    {svc}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-xs text-dark-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={errorOnlyFilter}
                  onChange={(e) => setErrorOnlyFilter(e.target.checked)}
                  className="rounded border-dark-700 bg-dark-900 text-primary-500 focus:ring-0"
                />
                Errors Only
              </label>
            </div>

            <div className="glass-card divide-y divide-dark-800/80 max-h-[680px] overflow-y-auto">
              {tracesLoading ? (
                <div className="p-8 text-center text-dark-400 text-xs">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary-400" />
                  Loading traces...
                </div>
              ) : traces.length === 0 ? (
                <div className="p-8 text-center text-dark-400 text-xs">
                  No distributed traces found.
                </div>
              ) : (
                traces.map((t) => {
                  const isSelected = selectedTraceId === t.trace_id;
                  return (
                    <div
                      key={t.trace_id}
                      onClick={() => setSelectedTraceId(t.trace_id)}
                      className={`p-3.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary-500/10 border-l-4 border-l-primary-500'
                          : 'hover:bg-dark-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white text-xs truncate">
                          {t.root_name}
                        </span>
                        {t.has_error ? (
                          <Badge variant="danger" dot>
                            ERROR
                          </Badge>
                        ) : (
                          <Badge variant="success" dot>
                            OK
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-dark-400 mt-2 font-mono">
                        <span className="text-primary-300">{t.root_service}</span>
                        <span className="text-warning-300 font-semibold">{t.duration_ms.toFixed(1)} ms</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-dark-500 mt-1 font-mono">
                        <span>{t.span_count} spans</span>
                        <span>{new Date(t.start_time).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Waterfall Visualization (7 cols) */}
          <div className="lg:col-span-7">
            {traceDetailLoading ? (
              <div className="glass-card p-12 text-center text-dark-400 text-sm">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary-400" />
                Rendering trace waterfall...
              </div>
            ) : !traceDetail ? (
              <div className="glass-card p-12 text-center text-dark-400 text-sm">
                Select a trace from the left panel to inspect its waterfall hierarchy.
              </div>
            ) : (
              <div className="glass-card p-5 space-y-6">
                {/* Waterfall Header */}
                <div className="border-b border-dark-700/80 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        {traceDetail.root_span_name}
                      </h2>
                      <p className="text-xs text-dark-400 font-mono mt-0.5">
                        Trace ID: <span className="text-primary-300">{traceDetail.trace_id}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-dark-400 block">Total Duration</span>
                      <span className="text-lg font-bold text-warning-400 font-mono">
                        {traceDetail.duration_ms.toFixed(1)} ms
                      </span>
                    </div>
                  </div>
                </div>

                {/* Spans Waterfall Chart */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-dark-400 uppercase tracking-wider">
                    <span>Span &amp; Microservice</span>
                    <span>Timeline &amp; Latency</span>
                  </div>

                  <div className="space-y-3">
                    {spanHierarchy.map(({ span, depth, widthPct, leftPct }) => {
                      const isError = span.status_code === 'ERROR';
                      return (
                        <div
                          key={span.span_id}
                          className={`p-3 rounded-lg border transition-all ${
                            isError
                              ? 'bg-danger-500/10 border-danger-500/30'
                              : 'bg-dark-900/80 border-dark-700/60'
                          }`}
                          style={{ marginLeft: `${Math.min(depth * 18, 90)}px` }}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isError ? (
                                <AlertCircle className="h-4 w-4 text-danger-400 shrink-0" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                              )}
                              <span className="font-semibold text-white font-mono">{span.name}</span>
                              <span className="px-1.5 py-0.5 rounded bg-dark-800 border border-dark-700 text-primary-300 text-[10px] font-sans">
                                {span.service_name}
                              </span>
                              <span className="text-[10px] text-dark-400 font-sans uppercase">
                                [{span.kind}]
                              </span>
                            </div>

                            <span className="font-mono text-xs font-semibold text-warning-300">
                              {span.duration_ms.toFixed(1)} ms
                            </span>
                          </div>

                          {/* Error Message Callout */}
                          {span.status_message && (
                            <p className="mt-2 text-xs text-danger-300 bg-danger-500/20 p-2 rounded border border-danger-500/30 font-mono">
                              Error: {span.status_message}
                            </p>
                          )}

                          {/* Relative Execution Bar */}
                          <div className="mt-2.5 h-2 bg-dark-800 rounded-full overflow-hidden relative">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isError ? 'bg-danger-500' : 'bg-primary-500'
                              }`}
                              style={{
                                width: `${widthPct}%`,
                                marginLeft: `${leftPct}%`,
                              }}
                            />
                          </div>

                          {/* Span Attributes */}
                          {Object.keys(span.attributes).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-dark-800/80 flex flex-wrap gap-2 text-[10px] text-dark-400 font-mono">
                              {Object.entries(span.attributes).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="px-1.5 py-0.5 rounded bg-dark-950 border border-dark-800 text-dark-300"
                                >
                                  <strong className="text-dark-400 font-sans">{k}:</strong>{' '}
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
