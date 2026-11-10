import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
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

  // New Monitor form
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMonitors = async () => {
    setIsLoading(true);
    try {
      const res = await monitorService.list();
      setMonitors(res.data);
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
    setIsSubmitting(true);
    try {
      await monitorService.create({
        name,
        url,
        method,
        interval_seconds: Number(intervalSeconds),
      });
      setIsModalOpen(false);
      setName('');
      setUrl('');
      await fetchMonitors();
    } catch {
      alert('Failed to register monitor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProbe = async (id: number) => {
    setProbingId(id);
    setProbeMessage(null);
    try {
      const res = await monitorService.probe(id);
      setProbeMessage(
        `Probe result: HTTP ${res.data.status_code} (${res.data.latency_ms}ms) — ${res.data.message || (res.data.is_up ? 'Operational' : 'Down')}`
      );
      await fetchMonitors();
    } catch {
      setProbeMessage('Probe request failed.');
    } finally {
      setProbingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this service monitor?')) return;
    try {
      await monitorService.delete(id);
      await fetchMonitors();
    } catch {
      alert('Delete failed.');
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100">
              Service Uptime & Health Monitor
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                allOperational
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {allOperational ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> All Systems Operational
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-rose-600" /> Issues Detected
                </>
              )}
            </span>
          </div>
          <p className="text-xs font-medium text-dark-400 mt-1">
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
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-3.5 text-xs text-primary-800 font-medium flex items-center justify-between shadow-2xs">
          <span>{probeMessage}</span>
          <button onClick={() => setProbeMessage(null)} className="text-primary-600 hover:text-primary-900 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Monitors List */}
      <div className="space-y-4">
        {monitors.map((m) => (
          <div
            key={m.id}
            className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-subtle hover:border-[#D1D5DB] hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    m.status === 'operational' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <h3 className="text-sm font-bold text-dark-100">{m.name}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-dark-400 border border-[#E5E7EB]">
                  {m.method}
                </span>
              </div>
              <p className="text-xs font-mono text-dark-400 flex items-center gap-1.5 font-medium">
                <Globe className="h-3.5 w-3.5 text-dark-400" />
                {m.url}
              </p>
            </div>

            {/* Probe Status Bar */}
            <div className="flex items-center gap-6">
              <div>
                <div className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider">30d Uptime</div>
                <div className="text-sm font-extrabold text-emerald-700">{m.uptime_percentage}%</div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider">Avg Latency</div>
                <div className="text-sm font-extrabold text-dark-100 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary-600" />
                  {m.avg_latency_ms}ms
                </div>
              </div>

              {/* Status history dots */}
              <div className="hidden lg:flex items-center gap-1">
                {m.recent_probes.map((code: number, idx: number) => (
                  <span
                    key={idx}
                    title={`Probe ${idx + 1}: HTTP ${code}`}
                    className={`h-6 w-1.5 rounded-sm ${code < 400 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleProbe(m.id)}
                  isLoading={probingId === m.id}
                  leftIcon={<Play className="h-3 w-3" />}
                >
                  Probe
                </Button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-2 rounded-xl text-dark-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Delete monitor"
                  aria-label="Delete monitor"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Monitor Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register HTTP Service Probe">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Service Identifier"
            placeholder="e.g. Production Auth Gateway"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Probe Endpoint URL"
            placeholder="https://api.devopspulse.com/healthz"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-300 mb-1.5 uppercase tracking-wide">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-dark-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-sm"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-300 mb-1.5 uppercase tracking-wide">Expected HTTP Status</label>
              <select
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(Number(e.target.value))}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-dark-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-sm"
              >
                <option value={200}>200 OK</option>
                <option value={204}>204 No Content</option>
                <option value={301}>301 Redirect</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Register Monitor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UptimePage;
