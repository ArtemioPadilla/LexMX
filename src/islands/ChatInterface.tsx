/**
 * /chat island (plan Fase 4): the conversation surface on the Inceptor AI
 * primitives. One island, one React root; thread state in Nano Stores;
 * every assistant turn is labeled as AI output, says whether it is grounded
 * in the installed corpus and lists its sources with a link to the official
 * text. Two modes: Pregunta (short, top-5 sources) and Investiga (broader,
 * top-12 sources).
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Settings2Icon, Trash2Icon, DatabaseIcon, ShieldCheckIcon, ShieldAlertIcon, ChevronDownIcon, CpuIcon } from 'lucide-react';
import type { LegalArea } from '@/types/legal';
import type { RAGProgressEvent, RAGSearchResult } from '@/types/embeddings';
import { LegalRAGEngine } from '@/lib/rag/engine';
import { providerManager } from '@/lib/llm/provider-manager';
import { createDisposer } from '@/lib/disposer';
import { buildIssueUrl } from '@/lib/report-issue';
import { useTranslation } from '@/i18n';
import { TEST_IDS } from '@/utils/test-ids';
import { $corpusInstall } from '@/stores/corpus';
import { $jurisdictionCode, setJurisdiction } from '@/stores/jurisdiction';
import { listJurisdictions } from '@/jurisdictions';
import { $chatMessages, $chatMode, appendMessage, nextMessageId, resetThread, takePendingPrompt, updateMessage, type ChatMessage as ThreadMessage, type ChatMode } from '@/stores/chat';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { ChatMessage, ChatThread } from '@/components/ui/ai/chat-message';
import { PromptInput } from '@/components/ui/ai/prompt-input';
import { DictationButton } from '@/components/ui/ai/dictation-button';
import { ThinkingIndicator } from '@/components/ui/ai/streaming-text';
import { CitationList, type CitationSource } from '@/components/ui/ai/citation';
import { AIOutputLabel } from '@/components/ui/ai/ai-output-label';
import { AIFeedback } from '@/components/ui/ai/ai-feedback';
import MessageContent from '@/components/MessageContent';
import RAGProgressIndicator from '@/components/RAGProgressIndicator';
import CorpusSelector from '@/components/CorpusSelector';
// Loaded on demand: the modal only when opened, the progress panel only while
// a local model downloads, the recommendation only once the user is typing.
const ModelSelectorModal = lazy(() => import('@/components/ModelSelectorModal'));
const WebLLMProgress = lazy(() => import('@/components/WebLLMProgress'));
const ProviderRecommendation = lazy(() => import('./ProviderRecommendation'));

export type { ThreadMessage as ChatMessage };

interface ChatInterfaceProps {
  className?: string;
  autoFocus?: boolean;
}

const LEGAL_AREAS: Array<LegalArea | ''> = ['', 'constitutional', 'civil', 'criminal', 'labor', 'tax', 'commercial', 'administrative', 'family', 'property'];
const MODE_RESULTS: Record<ChatMode, number> = { ask: 5, research: 12 };

function sourcesToCitations(sources: ThreadMessage['legalResponse'] extends infer R ? (R extends { sources: infer S } ? S : never) : never): CitationSource[] {
  const seen = new Set<string>();
  const out: CitationSource[] = [];
  for (const s of sources ?? []) {
    const label = s.article ? `${s.title} · Artículo ${s.article}` : s.title;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, url: s.url });
  }
  return out;
}

export default function ChatInterface({ className = '', autoFocus = true }: ChatInterfaceProps) {
  const { t, language } = useTranslation();
  /** Text present before dictation started; interim results replace what follows it. */
  const dictationBase = useRef<string | null>(null);
  // A prompt prepared by another page (/comparar) lands in the composer once.
  useEffect(() => {
    const pending = takePendingPrompt();
    if (pending) setCurrentInput(pending);
  }, []);
  const messages = useStore($chatMessages);
  const mode = useStore($chatMode);
  const corpus = useStore($corpusInstall);
  const jurisdiction = useStore($jurisdictionCode);

  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedArea, setSelectedArea] = useState<LegalArea | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ragEngine] = useState(() => new LegalRAGEngine());
  const [isInitialized, setIsInitialized] = useState(false);
  const [webllmProgress, setWebllmProgress] = useState<{ progress: number; message: string } | null>(null);
  const [ragProgressEvents, setRagProgressEvents] = useState<RAGProgressEvent[]>([]);
  const [ragDocuments, setRagDocuments] = useState<RAGSearchResult[]>([]);
  const [corpusSelection, setCorpusSelection] = useState<{ areas: LegalArea[]; documents: string[] }>({ areas: [], documents: [] });
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('webllm');
  const [currentModel, setCurrentModel] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCorpusSelectionChange = useCallback((selection: { areas: LegalArea[]; documents: string[] }) => {
    setCorpusSelection(selection);
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    appendMessage({ id: nextMessageId(), type: 'system', content, timestamp: Date.now() });
  }, []);

  // Welcome turn is created on the client only: the thread is empty on the
  // server, so there is nothing to mismatch.
  useEffect(() => {
    if ($chatMessages.get().length === 0) resetThread(t('chat.welcome'));
  }, []);

  useEffect(() => {
    const d = createDisposer();
    const progressListener = (progress: number, message: string) => {
      setWebllmProgress({ progress, message });
      if (progress === 100) d.timeout(3000, () => setWebllmProgress(null));
    };
    const ragProgressListener = (event: RAGProgressEvent) => {
      setRagProgressEvents((prev) => [...prev, event]);
      const details = event.details as { results?: RAGSearchResult[] } | undefined;
      if (event.stage === 'document_search' && event.status === 'completed' && details?.results) {
        setRagDocuments(details.results);
      }
      if (event.stage === 'response_generation' && event.status === 'completed') {
        d.timeout(2000, () => setRagProgressEvents([]));
      }
    };

    providerManager.addWebLLMProgressListener(progressListener);
    d.add(() => providerManager.removeWebLLMProgressListener(progressListener));
    ragEngine.onProgress(ragProgressListener);
    d.add(() => ragEngine.offProgress(ragProgressListener));

    let cancelled = false;
    (async () => {
      try {
        const timeout = new Promise((_, reject) => d.timeout(5000, () => reject(new Error('Initialization timeout'))));
        await Promise.race([providerManager.initialize(), timeout]).catch((err) => console.warn('Provider manager initialization warning:', err));
        await ragEngine.initialize().catch((err) => console.warn('RAG engine initialization warning:', err));
        if (cancelled) return;
        setIsInitialized(true);
        const hasProviders = await providerManager.hasConfiguredProviders().catch(() => false);
        if (!hasProviders && !cancelled) addSystemMessage('ℹ️ ' + t('chat.errors.noProviders'));
      } catch (error) {
        console.error('Failed to initialize system:', error);
        if (!cancelled) {
          setIsInitialized(true);
          addSystemMessage('⚠️ ' + t('common.error') + '. ' + t('chat.errors.providerError'));
        }
      }
    })();
    d.add(() => { cancelled = true; });
    return d.dispose;
  }, [ragEngine]);

  const handleSubmit = async () => {
    const text = currentInput.trim();
    if (!text || isProcessing) return;

    const hasProviders = await providerManager.hasConfiguredProviders();
    if (!hasProviders) {
      addSystemMessage('❌ ' + t('chat.errors.noProviders'));
      return;
    }

    appendMessage({ id: nextMessageId(), type: 'user', content: text, timestamp: Date.now(), mode });
    setCurrentInput('');
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();
    setRagProgressEvents([]);
    setRagDocuments([]);

    const answerId = nextMessageId();
    appendMessage({ id: answerId, type: 'assistant', content: '', timestamp: Date.now(), isStreaming: true, mode });

    try {
      let streamed = '';
      const legalResponse = await ragEngine.processLegalQueryStreaming(
        text,
        (chunk) => {
          streamed += chunk;
          updateMessage(answerId, { content: streamed, isStreaming: true });
        },
        {
          legalArea: selectedArea || undefined,
          includeReferences: true,
          maxResults: MODE_RESULTS[mode],
          corpusFilter: { ...corpusSelection, jurisdiction },
          abortSignal: abortControllerRef.current.signal,
        },
      );
      updateMessage(answerId, {
        content: legalResponse.answer,
        legalResponse,
        isStreaming: false,
        source: currentModel ? `${currentProvider} · ${currentModel}` : currentProvider,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      if (!aborted) console.error('Error processing legal query:', error);
      updateMessage(answerId, { content: aborted ? $chatMessages.get().find((m) => m.id === answerId)?.content || t('chat.stop') : t('chat.errors.providerError'), isStreaming: false });
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsProcessing(false);
  };

  const sendFeedback = (message: ThreadMessage, vote: 'up' | 'down', reason?: string) => {
    if (vote === 'up') return;
    const question = [...$chatMessages.get()].reverse().find((m) => m.type === 'user' && m.timestamp <= message.timestamp)?.content ?? '';
    const url = buildIssueUrl({
      title: t('chat.feedback.title'),
      labels: ['feedback', 'chat'],
      body: [
        `**Pregunta**: ${question}`,
        `**Modo**: ${message.mode ?? 'ask'} · **Proveedor**: ${message.source ?? 'n/d'} · **Grounded**: ${message.legalResponse?.grounded ? 'sí' : 'no'}`,
        reason ? `**Qué salió mal**: ${reason}` : '',
        '',
        '<details><summary>Respuesta</summary>',
        '',
        message.content,
        '',
        '</details>',
      ].join('\n'),
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const corpusLine = (() => {
    switch (corpus.phase) {
      case 'checking': return t('chat.corpus.checking');
      case 'installing': return t('chat.corpus.installing', { installed: corpus.installed, total: corpus.total });
      case 'ready': return t('chat.corpus.ready', { total: corpus.installed });
      case 'empty': return t('chat.corpus.empty');
      case 'error': return t('chat.corpus.error');
      default: return null;
    }
  })();

  const exampleQuestions = [1, 2, 3, 4, 5].map((i) => t(`chat.examples.q${i}`));

  return (
    <div data-testid={TEST_IDS.chat.container} className={cn('chat-interface flex h-full flex-col bg-background text-foreground', className)}>
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{t('chat.title')}</h1>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              {!isInitialized && <Badge variant="secondary">{t('common.loading')}</Badge>}
              {corpusLine && (
                <span className="inline-flex items-center gap-1">
                  <DatabaseIcon className="h-3 w-3" aria-hidden="true" />
                  {corpusLine}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <select
              aria-label={t('chat.jurisdiction')}
              title={t('chat.jurisdictionHint')}
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="mr-2 h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {listJurisdictions().map((j) => (
                <option key={j.code} value={j.code}>{j.code !== 'mx' ? `${j.name} · ${t('chat.corpusPending')}` : j.name}</option>
              ))}
            </select>
            <div role="radiogroup" aria-label="Modo" className="mr-2 inline-flex rounded-lg border border-border p-0.5 text-xs">
              {(['ask', 'research'] as ChatMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  title={t(`chat.mode.${m}Hint`)}
                  onClick={() => $chatMode.set(m)}
                  className={cn('rounded-md px-2.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
                >
                  {t(`chat.mode.${m}`)}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" aria-label={t('chat.advancedOptions')} aria-pressed={showAdvanced} onClick={() => setShowAdvanced((v) => !v)}>
              <Settings2Icon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={t('chat.clear')} data-testid={TEST_IDS.chat.clearButton} onClick={() => resetThread(t('chat.welcome'))}>
              <Trash2Icon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showAdvanced && (
          <div className="mt-3 rounded-lg bg-muted p-3">
            <label htmlFor="legal-area" className="mb-1 block text-xs font-medium text-muted-foreground">{t('chat.legalAreaSelect')}</label>
            <select
              id="legal-area"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value as LegalArea | '')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {LEGAL_AREAS.map((area) => (
                <option key={area || 'all'} value={area}>{t(`chat.legalArea.${area || 'all'}`)}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Thread */}
      <ChatThread label={t('chat.title')} className="flex-1 overflow-y-auto px-4 py-4" testId={TEST_IDS.chat.messageList}>
        {messages.map((message) => {
          if (message.type === 'system') {
            return (
              <Callout key={message.id} title={t('chat.system')} variant="default" className="max-w-3xl text-sm" data-testid={TEST_IDS.chat.welcomeMessage}>
                {message.content}
              </Callout>
            );
          }
          if (message.type === 'user') {
            return (
              <ChatMessage key={message.id} from="user">
                {message.content}
              </ChatMessage>
            );
          }
          const response = message.legalResponse;
          const grounded = response?.grounded === true && response.sources.length > 0;
          const citations = response ? sourcesToCitations(response.sources) : [];
          return (
            <ChatMessage
              key={message.id}
              from="assistant"
              className="[&>div:last-child]:max-w-[min(48rem,100%)]"
              footer={
                response && !message.isStreaming ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={grounded ? 'default' : 'outline'} className="gap-1 text-[0.65rem]">
                        {grounded ? <ShieldCheckIcon className="h-3 w-3" aria-hidden="true" /> : <ShieldAlertIcon className="h-3 w-3" aria-hidden="true" />}
                        {grounded ? t('chat.grounded') : t('chat.ungrounded')}
                      </Badge>
                      <span className="text-[0.7rem] text-muted-foreground">
                        {t('chat.confidence')}: {Math.round(response.confidence * 100)}% · {t('chat.area')}: {t(`chat.legalArea.${response.legalArea}`)} · {response.processingTime}ms{response.fromCache ? ` · ${t('chat.fromCache')}` : ''}
                      </span>
                    </div>
                    {citations.length > 0 && <CitationList sources={citations} />}
                    {response.legalWarning && (
                      <Callout title={t('chat.warningTitle')} variant="warning" className="text-xs">{response.legalWarning}</Callout>
                    )}
                    {response.recommendedActions && response.recommendedActions.length > 0 && (
                      <div className="text-xs">
                        <p className="mb-1 font-medium">{t('chat.recommendations')}</p>
                        <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                          {response.recommendedActions.map((a) => <li key={a}>{a}</li>)}
                        </ul>
                      </div>
                    )}
                    {response.relatedQueries && response.relatedQueries.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {response.relatedQueries.map((q) => (
                          <Button key={q} variant="outline" size="sm" className="h-7 rounded-full text-xs" onClick={() => setCurrentInput(q)}>{q}</Button>
                        ))}
                      </div>
                    )}
                    <AIOutputLabel source={message.source} confidence={grounded && response.confidence >= 0.5 ? 'normal' : 'low'} />
                    <AIFeedback onSubmit={(vote, reason) => sendFeedback(message, vote, reason)} />
                  </div>
                ) : undefined
              }
            >
              {message.isStreaming && (ragProgressEvents.length > 0 || ragDocuments.length > 0) && (
                <div className="mb-3" data-testid={TEST_IDS.chat.processingIndicator}>
                  <RAGProgressIndicator events={ragProgressEvents} documents={ragDocuments} variant="inline" showDetails />
                </div>
              )}
              {message.content ? (
                <MessageContent content={message.content} />
              ) : message.isStreaming ? (
                <ThinkingIndicator label={t('chat.processing')} />
              ) : null}
            </ChatMessage>
          );
        })}
      </ChatThread>

      {/* Examples */}
      {messages.length <= 1 && (
        <div className="shrink-0 border-t border-border bg-muted/40 p-4" data-testid={TEST_IDS.chat.exampleQuestions}>
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">{t('chat.examples.title')}</h2>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {exampleQuestions.map((q) => (
              <Button key={q} variant="outline" size="sm" className="h-auto justify-start whitespace-normal py-2 text-left text-xs" onClick={() => setCurrentInput(q)}>{q}</Button>
            ))}
          </div>
        </div>
      )}

      {currentInput.trim().length > 10 && !isProcessing && (
        <div className="shrink-0 px-4 pb-2">
          <Suspense fallback={null}><ProviderRecommendation query={currentInput} /></Suspense>
        </div>
      )}

      {webllmProgress && (
        <div className="shrink-0 border-t border-border bg-accent/40 p-4">
          <Suspense fallback={null}><WebLLMProgress progress={webllmProgress.progress} message={webllmProgress.message} variant="inline" /></Suspense>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <CorpusSelector onSelectionChange={handleCorpusSelectionChange} />
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setShowModelSelector(true)}>
            <CpuIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {currentProvider === 'webllm' ? 'WebLLM' : currentProvider}
              {currentModel && <span className="ml-1 text-muted-foreground">({currentModel.split('-')[0]})</span>}
            </span>
            <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
        <PromptInput
          value={currentInput}
          onValueChange={setCurrentInput}
          onSubmit={handleSubmit}
          streaming={isProcessing}
          onStop={handleStop}
          placeholder={t('chat.placeholder')}
          disabled={!isInitialized}
          onFocus={() => { void ragEngine.warmEmbeddings(); }}
          textareaTestId={TEST_IDS.chat.input}
          sendTestId={TEST_IDS.chat.sendButton}
          extra={
            <DictationButton
              locale={language}
              disabled={!isInitialized || isProcessing}
              labels={{
                start: t('chat.dictate'),
                stop: t('chat.dictating'),
                note: t('chat.dictationNote'),
                local: { start: t('chat.dictateLocal'), stop: t('chat.dictatingLocal'), note: t('chat.dictationLocalNote'), busy: t('chat.transcribing') },
              }}
              onTranscript={(text) => setCurrentInput((prev) => { const base = dictationBase.current ?? prev; dictationBase.current = base; return base ? `${base} ${text}` : text; })}
            />
          }
        />
        <p className="mt-2 text-xs text-muted-foreground">{isInitialized ? t('chat.inputHelp') : t('common.loading')}</p>
      </div>

      {showModelSelector && (
        <Suspense fallback={null}>
          <ModelSelectorModal
            isOpen={showModelSelector}
            onClose={() => setShowModelSelector(false)}
            currentProvider={currentProvider}
            currentModel={currentModel}
            onModelSelect={(provider, model) => {
              setCurrentProvider(provider);
              setCurrentModel(model || '');
              if (model) providerManager.setPreferredProvider(provider, model);
            }}
          />
        </Suspense>
      )}
      {autoFocus && <AutoFocus />}
    </div>
  );
}

/** Focuses the prompt once after mount (the PromptInput owns its textarea). */
function AutoFocus() {
  useEffect(() => {
    document.querySelector<HTMLTextAreaElement>(`[data-testid="${TEST_IDS.chat.input}"]`)?.focus();
  }, []);
  return null;
}
