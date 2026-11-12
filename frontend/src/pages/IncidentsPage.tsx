import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Plus,
  Search,
  Filter,
  User,
  MessageSquare,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  incidentService,
  Incident,
  IncidentDetail,
  IncidentStats,
  IncidentSeverity,
  IncidentPriority,
  IncidentStatus,
} from '@/services/incidents';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { CountUp } from '@/components/ui/CountUp';

export const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Incident Detail Drawer / Modal
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newSeverity, setNewSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [newPriority, setNewPriority] = useState<IncidentPriority>('P2');
  const [newService, setNewService] = useState<string>('api-service');
  const [newEnvironment, setNewEnvironment] = useState<string>('production');
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [sendSlack, setSendSlack] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, listData] = await Promise.all([
        incidentService.getStats(),
        incidentService.listIncidents(),
      ]);
      setStats(statsData);
      setIncidents(listData);
    } catch {
      setError('Failed to load incident management records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openDetail = async (id: number) => {
    setIsDetailLoading(true);
    try {
      const detail = await incidentService.getIncident(id);
      setSelectedIncident(detail);
    } catch {
      // Handled
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    setIsSubmitting(true);
    try {
      await incidentService.createIncident({
        title: newTitle.trim(),
        description: newDescription.trim(),
        severity: newSeverity,
        priority: newPriority,
        service: newService.trim(),
        environment: newEnvironment.trim(),
        send_email: sendEmail,
        send_slack: sendSlack,
      });
      setIsCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      await fetchData();
    } catch {
      alert('Failed to report incident. Please check fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (status: IncidentStatus) => {
    if (!selectedIncident) return;
    try {
      await incidentService.updateStatus(selectedIncident.id, {
        status,
        resolution_notes: status === 'RESOLVED' ? resolutionNotes : undefined,
        comment: `Status transitioned to ${status}`,
      });
      setIsResolving(false);
      setResolutionNotes('');
      await openDetail(selectedIncident.id);
      await fetchData();
    } catch {
      alert('Failed to update incident status.');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !commentText.trim()) return;

    try {
      await incidentService.addComment(selectedIncident.id, commentText.trim());
      setCommentText('');
      await openDetail(selectedIncident.id);
    } catch {
      alert('Failed to add comment to timeline.');
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;
    const matchesSeverity = severityFilter === 'ALL' || inc.severity === severityFilter;
    const matchesQuery =
      searchQuery === '' ||
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.service.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSeverity && matchesQuery;
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <Badge variant="danger">CRITICAL</Badge>;
      case 'HIGH':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">HIGH</span>;
      case 'MEDIUM':
        return <Badge variant="warning">MEDIUM</Badge>;
      case 'LOW':
        return <Badge variant="info">LOW</Badge>;
      default:
        return <Badge variant="neutral">{sev}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">Open</span>;
      case 'ACKNOWLEDGED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">Acknowledged</span>;
      case 'INVESTIGATING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Investigating</span>;
      case 'RESOLVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#7C3AED]">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Smart Incident Management
              </h1>
              <p className="text-sm text-slate-500">
                Incident lifecycle tracking, MTTR analytics, automated escalation and audit timelines
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Report Incident</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <AlertTriangle className="h-4 w-4 text-[#7C3AED]" />
            <span>Total</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats ? <CountUp value={stats.total_incidents} /> : 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold">
            <Flame className="h-4 w-4" />
            <span>Open</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600">
            {stats ? <CountUp value={stats.open_incidents} /> : 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="flex items-center gap-2 text-amber-600 text-xs font-semibold">
            <Clock className="h-4 w-4" />
            <span>Investigating</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">
            {stats ? <CountUp value={stats.investigating_incidents} /> : 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold">
            <AlertTriangle className="h-4 w-4" />
            <span>Critical P1</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">
            {stats ? <CountUp value={stats.critical_incidents} /> : 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            <span>Resolved</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">
            {stats ? <CountUp value={stats.resolved_incidents} /> : 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <Clock className="h-4 w-4 text-purple-600" />
            <span>MTTR</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats ? `${stats.mttr_minutes.toFixed(0)}m` : '0m'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-subtle">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {['ALL', 'OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                  statusFilter === st
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Severity Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="text-xs font-medium rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search incidents or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Incident List */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-rose-50/50 rounded-2xl border border-rose-200 p-8 text-center text-slate-500 shadow-subtle">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-500 mb-2" />
          <p className="text-sm font-medium text-rose-700">{error}</p>
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center shadow-subtle">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
          <h3 className="text-base font-bold text-slate-900">No Incidents Found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            All services are operating smoothly or no incidents match your current filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIncidents.map((incident) => (
            <div
              key={incident.id}
              onClick={() => openDetail(incident.id)}
              className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 shadow-subtle hover:border-purple-300 hover:shadow-card-hover transition-all cursor-pointer"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      #INC-{incident.id.toString().padStart(4, '0')}
                    </span>
                    {getSeverityBadge(incident.severity)}
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {incident.priority}
                    </span>
                    {getStatusBadge(incident.status)}
                    <span className="text-xs text-slate-500 font-medium">
                      Service: <strong className="text-slate-700">{incident.service}</strong>
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 font-medium">
                      Env: <strong className="text-slate-700">{incident.environment}</strong>
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 hover:text-[#7C3AED] transition-colors">
                    {incident.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {incident.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 sm:border-l sm:border-slate-100 sm:pl-4">
                  <div className="text-right text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 justify-end">
                      <User className="h-3.5 w-3.5" />
                      <span>{incident.assignee_name || 'Unassigned'}</span>
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      {new Date(incident.created_at).toLocaleDateString()} at{' '}
                      {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <Modal
          isOpen={!!selectedIncident}
          onClose={() => setSelectedIncident(null)}
          title={`Incident #INC-${selectedIncident.id.toString().padStart(4, '0')}`}
          size="lg"
        >
          {isDetailLoading ? (
            <div className="flex h-64 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Badges */}
              <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-slate-100">
                {getStatusBadge(selectedIncident.status)}
                {getSeverityBadge(selectedIncident.severity)}
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                  {selectedIncident.priority}
                </span>
                <span className="text-xs text-slate-500">
                  Service: <strong>{selectedIncident.service}</strong>
                </span>
                <span className="text-xs text-slate-500">
                  Environment: <strong>{selectedIncident.environment}</strong>
                </span>
              </div>

              {/* Title & Description */}
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedIncident.title}</h2>
                <div className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-700 whitespace-pre-wrap font-sans">
                  {selectedIncident.description}
                </div>
              </div>

              {/* Status Transition Actions */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                <span className="text-xs font-semibold text-purple-900 mr-2">Lifecycle Action:</span>
                {selectedIncident.status === 'OPEN' && (
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus('ACKNOWLEDGED')}
                    className="bg-[#7C3AED] text-white hover:bg-[#6D28D9] text-xs"
                  >
                    Acknowledge
                  </Button>
                )}
                {(selectedIncident.status === 'OPEN' || selectedIncident.status === 'ACKNOWLEDGED') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleUpdateStatus('INVESTIGATING')}
                    className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    Start Investigating
                  </Button>
                )}
                {selectedIncident.status !== 'RESOLVED' && selectedIncident.status !== 'CLOSED' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsResolving(!isResolving)}
                    className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    Resolve Incident...
                  </Button>
                )}
              </div>

              {/* Resolution Form */}
              {isResolving && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-900">Document Resolution Notes</h4>
                  <textarea
                    rows={3}
                    placeholder="Describe how the incident was mitigated or fixed..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsResolving(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus('RESOLVED')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      Confirm Resolution
                    </Button>
                  </div>
                </div>
              )}

              {/* Resolution Info if already resolved */}
              {selectedIncident.resolved_at && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Resolved at {new Date(selectedIncident.resolved_at).toLocaleString()}</span>
                  </div>
                  {selectedIncident.resolution_notes && (
                    <p className="mt-1 text-emerald-700">{selectedIncident.resolution_notes}</p>
                  )}
                </div>
              )}

              {/* Audit Timeline */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#7C3AED]" />
                  <span>Audit Timeline ({selectedIncident.timeline_events.length} events)</span>
                </h3>

                <div className="relative pl-6 space-y-4 border-l-2 border-purple-200 ml-2">
                  {selectedIncident.timeline_events.map((event) => (
                    <div key={event.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#7C3AED] shadow-xs" />
                      <div className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">
                            {event.user_name || 'System / Automation'}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-400">
                            {new Date(event.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-0.5 text-slate-600 font-medium">{event.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Comment */}
              <form onSubmit={handleAddComment} className="pt-4 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  placeholder="Add a timeline note or comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!commentText.trim()}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs shrink-0"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                  <span>Add Note</span>
                </Button>
              </form>
            </div>
          )}
        </Modal>
      )}

      {/* Create Incident Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Report New Incident"
        size="lg"
      >
        <form onSubmit={handleCreateIncident} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Incident Title *</label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Database connection pool exhaustion on production API"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description *</label>
            <textarea
              rows={4}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Provide symptoms, impacted customer traffic, error stack traces..."
              className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Severity</label>
              <select
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value as IncidentSeverity)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              >
                <option value="CRITICAL">CRITICAL (Service Outage)</option>
                <option value="HIGH">HIGH (Degraded Performance)</option>
                <option value="MEDIUM">MEDIUM (Partial Issue)</option>
                <option value="LOW">LOW (Minor / Cosmetic)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as IncidentPriority)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              >
                <option value="P1">P1 (Immediate response)</option>
                <option value="P2">P2 (Within 2 hours)</option>
                <option value="P3">P3 (Within 1 business day)</option>
                <option value="P4">P4 (Backlog)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Affected Service</label>
              <Input
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                placeholder="e.g. auth-service, payment-gateway"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Environment</label>
              <Input
                value={newEnvironment}
                onChange={(e) => setNewEnvironment(e.target.value)}
                placeholder="e.g. production, staging"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded text-[#7C3AED] focus:ring-[#7C3AED]"
                />
                <span>Email On-Call</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={sendSlack}
                  onChange={(e) => setSendSlack(e.target.checked)}
                  className="rounded text-[#7C3AED] focus:ring-[#7C3AED]"
                />
                <span>Notify Slack (#incidents)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs"
              >
                {isSubmitting ? 'Reporting...' : 'Create Incident'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
