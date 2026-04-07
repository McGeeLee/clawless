export function estimateTextTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return Math.ceil(trimmed.length / 4);
}

type PromptMessage = {
  content: string | ReadonlyArray<unknown>;
};

export function estimatePromptTokens(
  messages: ReadonlyArray<PromptMessage>,
): number {
  return messages.reduce(
    (total, message) => total + estimatePromptMessageTokens(message.content),
    0,
  );
}

export function estimatePromptMessageTokens(
  content: PromptMessage['content'],
): number {
  if (typeof content === 'string') {
    return estimateTextTokens(content);
  }

  return content.reduce<number>((total, part) => {
    if (
      typeof part === 'object' &&
      part !== null &&
      'text' in part &&
      typeof part.text === 'string'
    ) {
      return total + estimateTextTokens(part.text);
    }

    return total;
  }, 0);
}
