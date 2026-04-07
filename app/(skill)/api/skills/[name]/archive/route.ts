import {
  createSkillArchiveTar,
  listSkillFilesWithContentFromBlob,
} from '@/lib/core/blob/skills';
import { getSkillDetail } from '@/lib/core/kv/skills';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ name: string }> };

/**
 * GET /api/skills/[name]/archive — download a whole skill as a tar archive
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { name } = await params;
  const skillName = decodeURIComponent(name).trim();

  if (!skillName) {
    return Response.json({ error: 'Skill name is required' }, { status: 400 });
  }

  const detail = await getSkillDetail(skillName);
  if (!detail) {
    return Response.json(
      { error: `Skill "${skillName}" not found` },
      { status: 404 },
    );
  }

  const files = await listSkillFilesWithContentFromBlob(skillName);
  const archive = createSkillArchiveTar(skillName, files);
  const body = new Blob([Uint8Array.from(archive)], {
    type: 'application/x-tar',
  });

  return new Response(body, {
    headers: {
      'content-type': 'application/x-tar',
      'content-disposition': `attachment; filename="${skillName}.tar"`,
    },
  });
}
