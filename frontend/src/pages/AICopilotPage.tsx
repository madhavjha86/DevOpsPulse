import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle,
  Clock,
  Code,
  Copy,
  ExternalLink,
  Info,
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
import { MarkdownView } from '../components/ui/MarkdownView';
import {
  aiService,
  AIConversation,
  AIConversationDetail,
  AIRootCauseAnalysis,
  AIProviderStatus,
} from '../services/ai';

export const AICopilotPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'copilot' | 'rca'>('copilot');

  // AI Provider telemetry status
  const [aiStatus, setAiStatus] = useState<AIProviderStatus | null>(null);

  // Copilot state
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [conversationDetail, setConversationDetail] = useState<AIConversationDetail | null>(null);
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // RCA state
  const [rcas, setRcas] = useState<AIRootCauseAnalysis[]>([]);
  const [loadingRca, setLoadingRca] = useState(false);
  const [selectedRca, setSelectedRca] = useState<AIRootCauseAnalysis | null>(null);
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [manualLogExcerpt, setManualLogExcerpt] = useState('');
  const [manualJobName, setManualJobName] = useState('CI Pipeline Test Suite');
  const [analyzingLog, setAnalyzingLog] = useState(false);

  // Initial load
  useEffect(() => {
    aiService
      .getStatus()
      .then((res) => setAiStatus(res))
      .catch(() => {});
  }, []);

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
      void fetchConversations();
    } else {
      void fetchRCAs();
    }
  }, [activeTab, fetchConversations, fetchRCAs]);

  useEffect(() => {
    if (activeConversationId) {
      void fetchConversationDetail(activeConversationId);
    }
  }, [activeConversationId, fetchConversationDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationDetail?.messages]);

  const handleCreateNewThread = async () => {
    try {
      const newConv = await aiService.createConversation({
        title: 'New DevOps Investigation',
        initial_message: 'Hi, I need assistance diagnosing recent infrastructure and pipeline events.',
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
      sources: [],
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

  const copyText = (text: string, msgId: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <Badge variant="danger">{severity}</Badge>;
      case 'HIGH':
        return <Badge variant="warning">{severity}</Badge>;
      case 'MEDIUM':
        return <Badge variant="neutral">{severity}</Badge>;
      default:
        return <Badge variant="neutral">{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary-600" />
              AI DevOps Intelligence Copilot
            </h1>
            {aiStatus && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  aiStatus.is_configured
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-sky-50 text-sky-800 border-sky-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    aiStatus.is_configured ? 'bg-emerald-500 animate-pulse' : 'bg-sky-500'
                  }`}
                />
                {aiStatus.is_configured
                  ? `${aiStatus.provider.toUpperCase()} (${aiStatus.model})`
                  : 'AI Telemetry Engine (Live Local)'}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-dark-400 mt-1">
            Real-time, multi-source infrastructure intelligence correlating GitHub, Docker, Kubernetes, OpenTelemetry logs, and AWS billing.
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

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
        <button
          onClick={() => setActiveTab('copilot')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'copilot'
              ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
              : 'bg-white border border-[#E5E7EB] text-dark-300 hover:text-dark-100 hover:bg-slate-50'
          }`}
        >
          <Bot className="w-4 h-4" />
          Interactive DevOps Copilot
        </button>
        <button
          onClick={() => setActiveTab('rca')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'rca'
              ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
              : 'bg-white border border-[#E5E7EB] text-dark-300 hover:text-dark-100 hover:bg-slate-50'
          }`}
        >
          <Terminal className="w-4 h-4 text-amber-500" />
          Root Cause Analysis Reports ({rcas.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: COPILOT CONVERSATION */}
      {/* ========================================================================= */}
      {activeTab === 'copilot' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[620px]">
          {/* Left Column: Conversations List */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-[#E5E7EB] p-4 flex flex-col shadow-subtle">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#F3F4F6]">
              <span className="text-xs font-bold text-dark-100 uppercase tracking-wider">
                Sessions ({conversations.length})
              </span>
              <button
                onClick={fetchConversations}
                disabled={loadingConv}
                className="text-dark-400 hover:text-primary-600 transition-colors"
                title="Refresh sessions"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingConv ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[500px]">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-xs text-dark-400">
                  No discussions yet. Click "New Discussion" to start.
                </div>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setActiveConversationId(c.id)}
                    className={`p-3 rounded-xl cursor-pointer text-xs transition-all flex items-center justify-between group ${
                      activeConversationId === c.id
                        ? 'bg-primary-50/70 border border-primary-200 text-primary-950 font-semibold'
                        : 'hover:bg-slate-50 border border-transparent text-dark-200'
                    }`}
                  >
                    <div className="truncate flex-1 pr-2">
                      <div className="truncate font-bold">{c.title}</div>
                      <div className="text-[10px] text-dark-400 mt-0.5 font-mono">
                        {new Date(c.updated_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(e, c.id)}
                      className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 p-1 transition-opacity"
                      title="Delete thread"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Chat Stream Area */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-[#E5E7EB] flex flex-col shadow-subtle overflow-hidden">
            {/* Thread Header */}
            <div className="px-5 py-3.5 border-b border-[#F3F4F6] bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary-600" />
                <span className="text-xs font-bold text-dark-100">
                  {conversationDetail?.title || 'Active Investigation'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-dark-400">
                {conversationDetail?.messages.length || 0} messages
              </span>
            </div>

            {/* Messages Scroll View */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[460px]">
              {loadingMessages ? (
                <div className="py-20 flex justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary-600" />
                </div>
              ) : conversationDetail?.messages.length === 0 ? (
                <div className="py-20 text-center text-xs text-dark-400">
                  <Bot className="h-10 w-10 mx-auto text-dark-300 mb-2" />
                  Ask any question about your repositories, CI/CD failures, or infrastructure health below.
                </div>
              ) : (
                conversationDetail?.messages.map((m) => {
                  const isUser = m.role === 'user';
                  const isCopied = copiedMessageId === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-3 text-xs ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl p-4 space-y-2.5 ${
                          isUser
                            ? 'bg-primary-600 text-white rounded-tr-xs shadow-xs'
                            : 'bg-slate-50 border border-[#E5E7EB] text-dark-100 rounded-tl-xs shadow-2xs'
                        }`}
                      >
                        {isUser ? (
                          <div className="whitespace-pre-wrap leading-relaxed font-sans">
                            {m.content}
                          </div>
                        ) : (
                          <MarkdownView content={m.content} />
                        )}

                        {/* Cited Grounding Sources */}
                        {!isUser && m.sources && m.sources.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/80 space-y-1">
                            <span className="text-[10px] font-bold text-dark-400 uppercase tracking-wider block">
                              Verified Evidence Sources Cited:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {m.sources.map((src, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white border border-[#E5E7EB] text-dark-300"
                                >
                                  <Info className="h-2.5 w-2.5 text-primary-600" />
                                  {src.title}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Metadata Footer */}
                        <div
                          className={`flex items-center justify-between text-[10px] pt-1 font-mono ${
                            isUser ? 'text-primary-100' : 'text-dark-400'
                          }`}
                        >
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {!isUser && (
                            <button
                              onClick={() => copyText(m.content, m.id)}
                              className="hover:text-primary-600 flex items-center gap-1 transition-colors"
                              title="Copy response"
                            >
                              {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              <span>{isCopied ? 'Copied' : 'Copy'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {sendingMessage && (
                <div className="flex gap-3 text-xs items-center text-dark-400">
                  <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1.5 py-2 px-3 bg-slate-50 rounded-xl border border-[#E5E7EB]">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary-600" />
                    <span>Aggregating real-time telemetry and reasoning...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Prompt Chips */}
            <div className="px-5 py-2 border-t border-[#F3F4F6] bg-slate-50/70 flex items-center gap-2 overflow-x-auto text-[11px]">
              <span className="text-dark-400 font-bold shrink-0">Quick Prompts:</span>
              {[
                'Why did my latest deployment fail?',
                'Show recent production errors.',
                'Why is my AWS bill increasing?',
                'Which Docker containers are unhealthy?',
                'Summarize active incidents.',
              ].map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(undefined, p)}
                  disabled={sendingMessage}
                  className="px-2.5 py-1 rounded-full bg-white border border-[#E5E7EB] text-dark-300 hover:text-primary-600 hover:border-primary-300 hover:shadow-2xs transition-all shrink-0"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3.5 border-t border-[#E5E7EB] flex gap-2">
              <Input
                placeholder="Ask DevOps Copilot about your pipelines, cluster health, or error traces..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={sendingMessage || !activeConversationId}
                className="flex-1 text-xs"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={sendingMessage || !messageInput.trim() || !activeConversationId}
                leftIcon={<Send className="h-3.5 w-3.5" />}
              >
                Send
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ROOT CAUSE ANALYSIS REPORTS */}
      {/* ========================================================================= */}
      {activeTab === 'rca' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: RCA List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-sm font-bold text-dark-100">Historical RCA Investigations</h3>
              <span className="text-xs text-dark-400 font-mono">{rcas.length} reports</span>
            </div>

            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {loadingRca ? (
                <div className="py-20 flex justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary-600" />
                </div>
              ) : rcas.length === 0 ? (
                <div className="p-8 text-center text-xs text-dark-400 bg-white rounded-2xl border border-[#E5E7EB]">
                  No failure investigations recorded yet. Click "Analyze Failure Log" to start.
                </div>
              ) : (
                rcas.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRca(r)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedRca?.id === r.id
                        ? 'border-primary-500 bg-primary-50/50 shadow-2xs'
                        : 'border-[#E5E7EB] bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono font-bold text-primary-700 bg-white px-2 py-0.5 rounded border border-primary-200">
                        #{r.id}
                      </span>
                      {getSeverityBadge(r.severity)}
                    </div>
                    <h4 className="text-xs font-bold text-dark-100 line-clamp-1">{r.summary}</h4>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-dark-400">
                      <span className="font-mono">{r.failure_category}</span>
                      <span>{Math.round(r.confidence_score * 100)}% confidence</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Selected RCA Detailed Report */}
          <div className="lg:col-span-2">
            {selectedRca ? (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-subtle space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-[#F3F4F6] pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-dark-400">RCA #{selectedRca.id}</span>
                      {getSeverityBadge(selectedRca.severity)}
                      <Badge variant={selectedRca.status === 'resolved' ? 'success' : 'neutral'}>
                        {selectedRca.status.toUpperCase()}
                      </Badge>
                    </div>
                    <h2 className="text-base font-bold text-dark-100">{selectedRca.summary}</h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedRca.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateRCAStatus(selectedRca.id, 'resolved')}
                        leftIcon={<CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>

                {/* Insufficient Data Warning Banner */}
                {selectedRca.is_insufficient_data && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>INSUFFICIENT_DATA:</strong> Telemetry was inadequate to draw a definitive conclusion.
                      No speculative causes were fabricated.
                    </span>
                  </div>
                )}

                {/* Root Cause Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-[#E5E7EB] space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-dark-400">Root Cause Hypothesis:</span>
                  <p className="text-xs text-dark-100 font-medium leading-relaxed">{selectedRca.root_cause}</p>
                  <p className="text-[11px] font-mono text-dark-400 mt-1">{selectedRca.confidence_explanation}</p>
                </div>

                {/* Chronological Evidence Timeline */}
                {selectedRca.evidence_timeline && selectedRca.evidence_timeline.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-dark-400">
                      Chronological Incident Timeline:
                    </span>
                    <div className="border-l-2 border-primary-200 ml-2 space-y-3 pl-3 text-xs">
                      {selectedRca.evidence_timeline.map((evt, idx) => (
                        <div key={idx} className="relative">
                          <span className="absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary-600 ring-4 ring-white" />
                          <div className="font-mono text-[10px] text-dark-400">
                            {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {evt.source}
                          </div>
                          <div className="font-medium text-dark-100 mt-0.5">{evt.event}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remediation Steps Checklist */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-dark-400">
                    Recommended Remediation Actions:
                  </span>
                  <ul className="space-y-2">
                    {selectedRca.remediation_steps.map((step, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-xs text-dark-200 bg-slate-50/70 p-2.5 rounded-xl border border-[#F3F4F6]"
                      >
                        <span className="flex h-5 w-5 rounded-full bg-primary-100 text-primary-700 items-center justify-center font-bold text-[10px] shrink-0">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suggested Diff */}
                {selectedRca.suggested_fix_diff && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-dark-400">
                      Suggested Fix Diff:
                    </span>
                    <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                      {selectedRca.suggested_fix_diff}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-16 text-center text-xs text-dark-400 bg-white rounded-2xl border border-[#E5E7EB]">
                Select an investigation from the left column to view the full Root Cause Analysis report.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual RCA Modal */}
      <Modal
        isOpen={isAnalyzeModalOpen}
        onClose={() => setIsAnalyzeModalOpen(false)}
        title="Analyze Build Failure or Error Log"
      >
        <form onSubmit={handleTriggerManualRCA} className="space-y-4">
          <Input
            label="Pipeline / Job Name"
            placeholder="e.g. CI Pipeline Test Suite"
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
            <Button type="submit" variant="primary" disabled={analyzingLog || !manualLogExcerpt.trim()}>
              {analyzingLog ? 'Analyzing Telemetry...' : 'Generate RCA'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AICopilotPage;
