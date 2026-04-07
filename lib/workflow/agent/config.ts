/** Maximum steps in a single stream (prevents infinite loops). */
export const DEFAULT_MAIN_MAX_STEPS = 30;

/** Default context token limit. */
export const DEFAULT_CONTEXT_LIMIT = 128_000;

/** Number of recent rounds to keep in the sliding window. */
export const DEFAULT_SLIDING_WINDOW_ROUNDS = 5;

/** Token usage threshold for triggering compression (relative to context_limit). */
export const DEFAULT_THRESHOLD_TO_SUMMARY = 0.8;

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Answer concisely and accurately.`;

export const DEFAULT_SUMMARY_PROMPT = `You are a conversation summarizer. Given the conversation below, produce a concise summary that captures all important context, decisions, and open questions. The summary will be used as long-term memory for future turns. Output ONLY the summary text, no preamble.`;

/** Workflow run statuses considered resumable. */
export const ACTIVE_RUN_STATUSES = new Set([
  'pending',
  'running',
  'workflow_suspended',
  'waiting',
]);
