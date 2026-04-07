import {
  getBuiltinMemoryRow,
  listBuiltinMemoryRows,
  upsertBuiltinMemoryRow,
} from '@/lib/core/db/memory/builtin';
import {
  BUILTIN_MEMORY_KEYS,
  BUILTIN_MEMORY_MAX_LENGTH,
  type BuiltinMemoryKey,
  type BuiltinMemorySection,
} from '@/types/memory';

function materializeBuiltinSection(
  key: BuiltinMemoryKey,
  rows: Awaited<ReturnType<typeof listBuiltinMemoryRows>>,
): BuiltinMemorySection {
  const row = rows.find((item) => item.key === key);

  return {
    key,
    content: row?.content ?? '',
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

export async function getBuiltinMemorySection(key: BuiltinMemoryKey) {
  const row = await getBuiltinMemoryRow(key);

  return {
    key,
    content: row?.content ?? '',
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  } satisfies BuiltinMemorySection;
}

export async function listBuiltinMemorySections() {
  const rows = await listBuiltinMemoryRows();

  return BUILTIN_MEMORY_KEYS.map((key) => materializeBuiltinSection(key, rows));
}

export async function setBuiltinMemorySection(
  key: BuiltinMemoryKey,
  content: string,
) {
  const trimmed = content.slice(0, BUILTIN_MEMORY_MAX_LENGTH);
  const row = await upsertBuiltinMemoryRow(key, trimmed);

  return {
    section: {
      key,
      content: row.content,
      updatedAt: row.updatedAt.toISOString(),
    } satisfies BuiltinMemorySection,
    truncated: content.length > BUILTIN_MEMORY_MAX_LENGTH,
  };
}
