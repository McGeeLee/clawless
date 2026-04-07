export interface HybridSearchRow {
  chunkId: string;
  memoryId: string;
  content: string;
  vectorScore: number;
  keywordScore: number;
  finalScore: number;
}

export interface VectorSearchCandidate {
  chunkId: string;
  memoryId: string;
  content: string;
  vectorScore: number;
}

export interface KeywordSearchCandidate {
  chunkId: string;
  memoryId: string;
  content: string;
  keywordScore: number;
}

const DEFAULT_CANDIDATE_POOL = 20;
const MAX_CANDIDATE_POOL = 200;

export function buildMemorySearchText(input: {
  query?: string;
  keywords?: string[];
}) {
  const query = input.query?.trim();
  if (query) {
    return query;
  }

  const joinedKeywords = input.keywords?.join(' ').trim();
  return joinedKeywords || '';
}

export function getHybridCandidateLimit(input: {
  limit: number;
  offset: number;
}) {
  return Math.min(
    Math.max(
      input.limit + input.offset,
      input.limit * 3,
      DEFAULT_CANDIDATE_POOL,
    ),
    MAX_CANDIDATE_POOL,
  );
}

export function mergeHybridSearchCandidates(input: {
  vectorRows: VectorSearchCandidate[];
  keywordRows: KeywordSearchCandidate[];
  minConfidence: number;
  limit: number;
  offset: number;
}): HybridSearchRow[] {
  const merged = new Map<string, HybridSearchRow>();

  for (const row of input.vectorRows) {
    merged.set(row.chunkId, {
      chunkId: row.chunkId,
      memoryId: row.memoryId,
      content: row.content,
      vectorScore: row.vectorScore,
      keywordScore: 0,
      finalScore: row.vectorScore * 0.7,
    });
  }

  for (const row of input.keywordRows) {
    const existing = merged.get(row.chunkId);
    if (existing) {
      existing.keywordScore = row.keywordScore;
      existing.finalScore =
        existing.vectorScore * 0.7 + existing.keywordScore * 0.3;
      continue;
    }

    merged.set(row.chunkId, {
      chunkId: row.chunkId,
      memoryId: row.memoryId,
      content: row.content,
      vectorScore: 0,
      keywordScore: row.keywordScore,
      finalScore: row.keywordScore * 0.3,
    });
  }

  return [...merged.values()]
    .filter((row) => row.finalScore >= input.minConfidence)
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) {
        return right.finalScore - left.finalScore;
      }

      if (right.vectorScore !== left.vectorScore) {
        return right.vectorScore - left.vectorScore;
      }

      if (right.keywordScore !== left.keywordScore) {
        return right.keywordScore - left.keywordScore;
      }

      return left.chunkId.localeCompare(right.chunkId);
    })
    .slice(input.offset, input.offset + input.limit);
}
