const SESSION_TITLE_MAX_LENGTH = 32;

export function deriveSessionTitle(text: string): string | null {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return null;
  }

  if (normalized.length <= SESSION_TITLE_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, SESSION_TITLE_MAX_LENGTH).trimEnd()}...`;
}
