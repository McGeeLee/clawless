import { getSkillDetail, removeSkillDetail } from '@/lib/core/kv/skills';
import type { NextRequest } from 'next/server';

type RouteParams = { params: Promise<{ name: string }> };

/**
 * GET /api/skills/[name] — get skill detail (metadata + file tree, no file content)
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { name } = await params;
  const trimmed = decodeURIComponent(name).trim();

  if (!trimmed) {
    return Response.json({ error: 'Skill name is required' }, { status: 400 });
  }

  const detail = await getSkillDetail(trimmed);
  if (!detail) {
    return Response.json(
      { error: `Skill "${trimmed}" not found` },
      { status: 404 },
    );
  }

  return Response.json(detail);
}

/**
 * DELETE /api/skills/[name] — delete a single skill
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { name } = await params;
  const trimmed = decodeURIComponent(name).trim();

  if (!trimmed) {
    return Response.json({ error: 'Skill name is required' }, { status: 400 });
  }

  const removed = await removeSkillDetail(trimmed);
  if (!removed) {
    return Response.json(
      { error: `Skill "${trimmed}" not found` },
      { status: 404 },
    );
  }

  return Response.json({ success: true, name: trimmed });
}
