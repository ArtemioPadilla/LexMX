// Shared "raw" completion shape returned by each cloud provider's private
// `complete()`/`streamInternal()` helper, before `generateResponse()`/`stream()`
// normalize it into the shared `LLMResponse` (see src/types/llm.ts).
//
// Providers parse untyped JSON from their respective HTTP APIs, so this type
// exists purely to give the *provider-internal* handoff a concrete shape
// instead of leaking `any` across the class boundary.
export interface RawCompletionResult {
  content: string;
  role: 'assistant';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string;
  processingTime: number;
}
