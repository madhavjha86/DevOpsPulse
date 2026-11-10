import React, { useEffect, useState } from 'react';
import {
  Activity,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  Trash2,
  Play,
} from 'lucide-react';
import { monitorService, Monitor } from '@/services/monitors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export const UptimePage: React.FC = () => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [probingId, setProbingId] = useState<number | null>(null);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [interval, setInterval] = useState(60);

  const fetchMonitors = async () => {
    setIsLoading(true);
    try {
      const { data } = await monitorService.list();
      setMonitors(data);
    } catch (err) {
      console.error('Failed to load monitors', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await monitorService.create({
        name,
        url,
        method,
        interval_seconds: Number(interval),
      });
      setIsModalOpen(false);
      setName('');
      setUrl('');
      fetchMonitors();
    } catch (err) {
      console.error('Failed to create monitor', err);
    }
  };

  const handleProbe = async (id: number) => {
    setProbingId(id);
    setProbeMessage(null);
    try {
      const { data } = await monitorService.probe(id);
      setProbeMessage(`Ping successful: HTTP ${data.status_code} (${data.latency_ms}ms)`);
      fetchMonitors();
    } catch {
      setProbeMessage('Probe failed to reach target endpoint.');
    } finally {
      setProbingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this monitor?')) return;
    try {
      await monitorService.delete(id);
      fetchMonitors();
    } catch (err) {
      console.error('Failed to delete monitor', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const allOperational = monitors.every((m) => m.status === 'operational');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Service Uptime & Health Monitor
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                allOperational
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {allOperational ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> All Systems Operational
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5" /> Issues Detected
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-dark-400 mt-1">
            Real-time synthetic HTTP probes and latency tracking for APIs, databases, and microservices
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={fetchMonitors} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Add Service Monitor
          </Button>
        </div>
      </div>

      {probeMessage && (
        <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 p-3 text-xs text-primary-300 flex items-center justify-between">
          <span>{probeMessage}</span>
          <button onClick={() => setProbeMessage(null)} className="text-dark-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {/* Monitors List */}
      <div className="space-y-4">
        {monitors.map((m) => (
          <div
            key={m.id}
            className="glass-card p-5 border border-dark-700/60 hover:border-dark-600 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    m.status === 'operational' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                <h3 className="text-sm font-semibold text-white">{m.name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-dark-800 text-dark-300 border border-dark-700">
                  {m.method}
                </span>
              </div>
              <p className="text-xs font-mono text-dark-400 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                {m.url}
              </p>
            </div>

            {/* Probe Status Bar */}
            <div className="flex items-center gap-6">
              <div>
                <div className="text-[11px] text-dark-400">30d Uptime</div>
                <div className="text-sm font-bold text-emerald-400">{m.uptime_percentage}%</div>
              </div>

              <div>
                <div className="text-[11px] text-dark-400">Avg Latency</div>
                <div className="text-sm font-bold text-white flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary-400" />
                  {m.avg_latency_ms}ms
                </div>
              </div>

              {/* Status history dots */}
              <div className="hidden lg:flex items-center gap-1">
                {m.recent_probes.map((code, idx) => (
                  <span
                    key={idx}
                    title={`Probe ${idx + 1}: HTTP ${code}`}
                    className={`h-6 w-1.5 rounded-sm ${code < 400 ? 'bg-emerald-500/80' : 'bg-rose-500'}`}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleProbe(m.id)}
                  disabled={probingId === m.id}
                  leftIcon={
                    probingId === m.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )
                  }
                >
                  Ping
                </Button>
                {m.id > 3 && (
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="p-2 rounded-lg text-dark-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Monitor Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Service Health Monitor">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Service Name"
            placeholder="e.g. Production Payment API"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Endpoint URL"
            placeholder="https://api.example.com/health"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">HTTP Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-lg border border-dark-700 bg-dark-900/80 px-3 py-2 text-xs text-white focus:border-primary-500 focus:outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">Check Interval</label>
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-full rounded-lg border border-dark-700 bg-dark-900/80 px-3 py-2 text-xs text-white focus:border-primary-500 focus:outline-none"
              >
                <option value={30}>Every 30 seconds</option>
                <option value={60}>Every 1 minute</option>
                <option value={300}>Every 5 minutes</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Monitor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
