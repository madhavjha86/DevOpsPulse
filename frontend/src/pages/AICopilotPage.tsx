import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle,
  Clock,
  Code,
  FileCode,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  aiService,
  AIConversation,
  AIConversationDetail,
  AIRootCauseAnalysis,
} from '../services/ai';

export const AICopilotPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'copilot' | 'rca'>('copilot');

  // Copilot state
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [conversationDetail, setConversationDetail] = useState<AIConversationDetail | null>(null);
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // RCA state
  const [rcas, setRcas] = useState<AIRootCauseAnalysis[]>([]);
  const [loadingRca, setLoadingRca] = useState(false);
  const [selectedRca, setSelectedRca] = useState<AIRootCauseAnalysis | null>(null);
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [manualLogExcerpt, setManualLogExcerpt] = useState('');
  const [manualJobName, setManualJobName] = useState('CI Pipeline Test Suite');
  const [analyzingLog, setAnalyzingLog] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoadingConv(true);
    try {
      const data = await aiService.getConversations();
      setConversations(data);
      if (data.length > 0 && !activeConversationId) {
        setActiveConversationId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoadingConv(false);
    }
  }, [activeConversationId]);

  const fetchConversationDetail = useCallback(async (id: number) => {
    setLoadingMessages(true);
    try {
      const detail = await aiService.getConversation(id);
      setConversationDetail(detail);
    } catch (err) {
      console.error('Failed to load conversation messages', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const fetchRCAs = useCallback(async () => {
    setLoadingRca(true);
    try {
      const data = await aiService.listRCAs();
      setRcas(data);
      if (data.length > 0 && !selectedRca) {
        setSelectedRca(data[0]);
      }
    } catch (err) {
      console.error('Failed to load RCAs', err);
    } finally {
      setLoadingRca(false);
    }
  }, [selectedRca]);

  useEffect(() => {
    if (activeTab === 'copilot') {
      fetchConversations();
    } else {
      fetchRCAs();
    }
  }, [activeTab, fetchConversations, fetchRCAs]);

  useEffect(() => {
    if (activeConversationId) {
      fetchConversationDetail(activeConversationId);
    }
  }, [activeConversationId, fetchConversationDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationDetail?.messages]);

  const handleCreateNewThread = async () => {
    try {
      const newConv = await aiService.createConversation({
        title: 'New DevOps Session',
        initial_message: 'Hi, I need assistance diagnosing an issue with my DevOps workflow.',
      });
      setConversations((prev) => [
        {
          id: newConv.id,
          title: newConv.title,
          created_at: newConv.created_at,
          updated_at: newConv.updated_at,
          message_count: newConv.messages.length,
        },
        ...prev,
      ]);
      setActiveConversationId(newConv.id);
      setConversationDetail(newConv);
    } catch (err) {
      console.error('Failed to create thread', err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, directPrompt?: string) => {
    if (e) e.preventDefault();
    const promptToSend = directPrompt || messageInput;
    if (!promptToSend.trim() || !activeConversationId || sendingMessage) return;

    setMessageInput('');
    setSendingMessage(true);

    // Optimistically show user message
    const tempUserMsg = {
      id: Date.now(),
      role: 'user' as const,
      content: promptToSend.trim(),
      context_metadata: {},
      created_at: new Date().toISOString(),
    };
    setConversationDetail((prev) =>
      prev ? { ...prev, messages: [...prev.messages, tempUserMsg] } : null
    );

    try {
      const reply = await aiService.sendMessage(activeConversationId, {
        content: promptToSend.trim(),
      });
      setConversationDetail((prev) =>
        prev ? { ...prev, messages: [...prev.messages, reply] } : null
      );
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation thread?')) return;
    try {
      await aiService.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  const handleTriggerManualRCA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLogExcerpt.trim() || analyzingLog) return;
    setAnalyzingLog(true);
    try {
      const generated = await aiService.generateRCA({
        log_excerpt: manualLogExcerpt.trim(),
        job_name: manualJobName.trim(),
      });
      setRcas((prev) => [generated, ...prev]);
      setSelectedRca(generated);
      setIsAnalyzeModalOpen(false);
      setManualLogExcerpt('');
    } catch (err) {
      console.error('RCA generation failed', err);
    } finally {
      setAnalyzingLog(false);
    }
  };

  const handleUpdateRCAStatus = async (id: number, newStatus: 'acknowledged' | 'resolved') => {
    try {
      const updated = await aiService.updateRCAStatus(id, newStatus);
      setRcas((prev) => prev.map((r) => (r.id === id ? updated : r)));
      if (selectedRca?.id === id) {
        setSelectedRca(updated);
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <Badge variant="danger">{severity}</Badge>;
      case 'HIGH':
        return <Badge variant="warning">{severity}</Badge>;
      case 'MEDIUM':
        return <Badge variant="info">{severity}</Badge>;
      default:
        return <Badge variant="neutral">{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary-600" />
            AI DevOps Copilot &amp; Root Cause Analysis
          </h1>
          <p className="text-sm font-medium text-dark-400 mt-1">
            Context-aware AI engineering assistant and automated post-mortem root cause diagnostic engine.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'copilot' ? (
            <Button variant="primary" size="sm" onClick={handleCreateNewThread}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Discussion
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setIsAnalyzeModalOpen(true)}>
              <Terminal className="h-4 w-4 mr-1.5" />
              Analyze Failure Log
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#E5E7EB] space-x-6">
        <button
          onClick={() => setActiveTab('copilot')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all duration-150 ${
            activeTab === 'copilot'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-dark-400 hover:text-dark-100'
          }`}
        >
          <Bot className="h-4 w-4" />
          Interactive DevOps Copilot
        </button>
        <button
          onClick={() => setActiveTab('rca')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all duration-150 ${
            activeTab === 'rca'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-dark-400 hover:text-dark-100'
          }`}
        >
          <Zap className="h-4 w-4" />
          Root Cause Analysis (RCA) Center
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: COPILOT CHAT ASSISTANT */}
      {/* ========================================================================= */}
      {activeTab === 'copilot' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
          {/* Left Column: Conversation Sessions (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="glass-card p-3 flex items-center justify-between text-xs text-dark-400">
              <span className="font-semibold uppercase tracking-wider">Discussions</span>
              <span>{conversations.length} Threads</span>
            </div>

            <div className="glass-card divide-y divide-dark-800/80 max-h-[600px] overflow-y-auto">
              {loadingConv ? (
                <div className="p-8 text-center text-dark-400 text-xs">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary-400" />
                  Loading discussions...
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-dark-400 text-xs">No conversations yet.</div>
              ) : (
                conversations.map((c) => {
                  const isSelected = activeConversationId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveConversationId(c.id)}
                      className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between group ${
                        isSelected
                          ? 'bg-primary-500/10 border-l-4 border-l-primary-500'
                          : 'hover:bg-dark-800/50'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <p className="text-xs font-bold text-dark-100 truncate">{c.title}</p>
                        <p className="text-[11px] text-dark-500 mt-1 font-mono">
                          {new Date(c.updated_at).toLocaleDateString()} • {c.message_count} messages
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(e, c.id)}
                        className="text-dark-500 hover:text-danger-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Delete Thread"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Chat Stream (8 cols) */}
          <div className="lg:col-span-8 flex flex-col glass-card h-[680px] overflow-hidden">
            {/* Thread Header */}
            <div className="p-4 border-b border-[#E5E7EB] bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-600">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-dark-100">
                    {conversationDetail?.title || 'DevOpsPulse Copilot'}
                  </h3>
                  <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-sans font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online • Context Linked (Workflows, Telemetry, Docker, K8s)
                  </span>
                </div>
              </div>
            </div>

            {/* Message History */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-white">
              {loadingMessages ? (
                <div className="p-12 text-center text-dark-400 text-sm">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary-600" />
                  Loading message stream...
                </div>
              ) : !conversationDetail?.messages.length ? (
                <div className="text-center py-16 text-dark-400 space-y-3">
                  <Sparkles className="h-8 w-8 text-primary-600 mx-auto" />
                  <p className="text-sm">Ask anything about your DevOps pipelines, Docker containers, or Kubernetes clusters.</p>
                </div>
              ) : (
                conversationDetail.messages.map((m) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="h-7 w-7 rounded-md bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-600 shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                          isUser
                            ? 'bg-primary-600 text-white rounded-br-none shadow-sm'
                            : 'bg-slate-50 border border-[#E5E7EB] text-dark-100 rounded-bl-none font-sans shadow-sm'
                        }`}
                      >
                        <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                        <span className={`text-[10px] block mt-2 text-right ${isUser ? 'text-purple-100' : 'text-dark-400'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="px-4 py-2 border-t border-[#E5E7EB] bg-slate-50/70 flex items-center gap-2 overflow-x-auto text-[11px]">
              <span className="text-dark-500 font-semibold shrink-0">Prompts:</span>
              <button
                onClick={() =>
                  handleSendMessage(undefined, 'Generate a production GitHub Actions CI/CD workflow with caching.')
                }
                className="px-2.5 py-1 rounded-full bg-white border border-[#E5E7EB] text-dark-300 hover:text-primary-600 hover:border-primary-300 hover:shadow-subtle transition-all shrink-0"
              >
                🚀 Generate CI/CD YAML
              </button>
              <button
                onClick={() =>
                  handleSendMessage(undefined, 'How do I resolve a CrashLoopBackOff error on Kubernetes pods?')
                }
                className="px-2.5 py-1 rounded-full bg-white border border-[#E5E7EB] text-dark-300 hover:text-primary-600 hover:border-primary-300 hover:shadow-subtle transition-all shrink-0"
              >
                ☸️ Debug CrashLoopBackOff
              </button>
              <button
                onClick={() =>
                  handleSendMessage(undefined, 'How to troubleshoot Docker container OOMKilled and daemon issues?')
                }
                className="px-2.5 py-1 rounded-full bg-white border border-[#E5E7EB] text-dark-300 hover:text-primary-600 hover:border-primary-300 hover:shadow-subtle transition-all shrink-0"
              >
                🐳 Docker OOM &amp; Socket Guide
              </button>
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-[#E5E7EB] flex gap-2">
              <Input
                placeholder="Ask DevOps Copilot (e.g., 'Analyze build failure #42', 'Write Dockerfile')..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={sendingMessage}
                className="flex-1 text-xs"
              />
              <Button type="submit" variant="primary" size="sm" isLoading={sendingMessage}>
                <Send className="h-4 w-4 mr-1.5" />
                Send
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ROOT CAUSE ANALYSIS (RCA) CENTER */}
      {/* ========================================================================= */}
      {activeTab === 'rca' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: RCA List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="glass-card p-3 flex items-center justify-between text-xs text-dark-400">
              <span className="font-semibold uppercase tracking-wider">Historical RCAs</span>
              <span>{rcas.length} Reports</span>
            </div>

            <div className="glass-card divide-y divide-[#E5E7EB] max-h-[660px] overflow-y-auto">
              {loadingRca ? (
                <div className="p-8 text-center text-dark-400 text-xs">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary-600" />
                  Loading RCA reports...
                </div>
              ) : rcas.length === 0 ? (
                <div className="p-8 text-center text-dark-400 text-xs">
                  No failure analyses recorded yet.
                </div>
              ) : (
                rcas.map((r) => {
                  const isSelected = selectedRca?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRca(r)}
                      className={`p-4 cursor-pointer transition-colors space-y-2 ${
                        isSelected
                          ? 'bg-primary-50/70 border-l-4 border-l-primary-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-dark-100 truncate">{r.summary}</span>
                        {getSeverityBadge(r.severity)}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-dark-400 font-mono">
                        <span className="text-primary-600 font-semibold">{r.failure_category}</span>
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-dark-500 font-sans">
                        <span>Confidence: {(r.confidence_score * 100).toFixed(0)}%</span>
                        <span
                          className={`font-semibold capitalize ${
                            r.status === 'resolved'
                              ? 'text-emerald-600'
                              : r.status === 'acknowledged'
                              ? 'text-warning-600'
                              : 'text-dark-300'
                          }`}
                        >
                          Status: {r.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed RCA Diagnostic View (7 cols) */}
          <div className="lg:col-span-7">
            {!selectedRca ? (
              <div className="glass-card p-12 text-center text-dark-400 text-sm">
                Select an RCA report from the left panel to review remediation steps and code diffs.
              </div>
            ) : (
              <div className="glass-card p-6 space-y-6">
                {/* Header Card */}
                <div className="border-b border-[#E5E7EB] pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        {getSeverityBadge(selectedRca.severity)}
                        <span className="text-xs font-mono font-semibold text-primary-600">
                          {selectedRca.failure_category}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-dark-100 mt-1.5">{selectedRca.summary}</h2>
                    </div>

                    {/* Status Triage Controls */}
                    <div className="flex items-center gap-2">
                      {selectedRca.status !== 'resolved' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUpdateRCAStatus(selectedRca.id, 'acknowledged')}
                        >
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      {selectedRca.status !== 'resolved' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleUpdateRCAStatus(selectedRca.id, 'resolved')}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Mark Resolved
                        </Button>
                      ) : (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Resolved
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Root Cause Narrative */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-bold text-dark-400 tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-warning-500" />
                    Root Cause Diagnosis
                  </h4>
                  <div className="p-4 bg-slate-50 rounded-xl border border-[#E5E7EB] text-xs text-dark-100 leading-relaxed font-sans">
                    {selectedRca.root_cause}
                  </div>
                </div>

                {/* Numbered Remediation Action Steps */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-bold text-dark-400 tracking-wider flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-primary-600" />
                    Actionable Remediation Steps
                  </h4>
                  <div className="space-y-2">
                    {selectedRca.remediation_steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-xl border border-[#E5E7EB] text-xs text-dark-200 flex items-start gap-3"
                      >
                        <span className="h-5 w-5 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggested Fix Diff */}
                {selectedRca.suggested_fix_diff && (
                  <div className="space-y-2">
                    <h4 className="text-xs uppercase font-bold text-dark-400 tracking-wider flex items-center gap-1.5">
                      <FileCode className="h-4 w-4 text-emerald-600" />
                      Suggested Patch / Fix Diff
                    </h4>
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed text-slate-100">
                      {selectedRca.suggested_fix_diff.split('\n').map((line, i) => {
                        const isAdd = line.startsWith('+');
                        const isSub = line.startsWith('-');
                        return (
                          <div
                            key={i}
                            className={
                              isAdd
                                ? 'text-emerald-400 bg-emerald-500/10 px-1'
                                : isSub
                                ? 'text-rose-400 bg-rose-500/10 px-1'
                                : 'text-slate-400'
                            }
                          >
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual RCA Modal */}
      <Modal
        isOpen={isAnalyzeModalOpen}
        onClose={() => setIsAnalyzeModalOpen(false)}
        title="Analyze Pipeline / Container Failure Log"
      >
        <form onSubmit={handleTriggerManualRCA} className="space-y-4">
          <p className="text-xs text-dark-400">
            Paste error stack traces, pytest failures, or Docker build logs below. The AI diagnostic engine will categorize the failure and generate remediation steps.
          </p>

          <Input
            label="Job / Pipeline Name"
            placeholder="e.g., Pytest Unit Tests, Docker Production Build"
            value={manualJobName}
            onChange={(e) => setManualJobName(e.target.value)}
            required
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-dark-300">Failure Log Excerpt</label>
            <textarea
              rows={7}
              placeholder="Paste stderr, stack trace, or build log here..."
              value={manualLogExcerpt}
              onChange={(e) => setManualLogExcerpt(e.target.value)}
              required
              className="w-full bg-white border border-[#E5E7EB] rounded-xl p-3 text-xs text-dark-100 font-mono focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAnalyzeModalOpen(false)}
              disabled={analyzingLog}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={analyzingLog}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Generate RCA
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
