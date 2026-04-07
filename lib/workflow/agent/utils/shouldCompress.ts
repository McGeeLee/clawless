export function shouldCompress(
  totalTokensUsed: number,
  contextLimit: number | undefined,
  threshold = 0.8,
  force = false,
): boolean {
  if (force) return true;
  if (!contextLimit || contextLimit <= 0) return false;
  return totalTokensUsed >= contextLimit * threshold;
}
