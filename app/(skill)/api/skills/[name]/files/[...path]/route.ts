import { getSkillFileContentFromBlob } from '@/lib/core/blob/skills';
import { getSkillDetail, updateSkillFile } from '@/lib/core/kv/skills';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

type RouteParams = { params: Promise<{ name: string; path: string[] }> };

function resolveParams(
  name: string,
  pathSegments: string[],
): { skillName: string; filePath: string } | null {
  const skillName = decodeURIComponent(name).trim();
  const filePath = pathSegments.map(decodeURIComponent).join('/').trim();

  if (!skillName || !filePath) return null;
  return { skillName, filePath };
}

/**
 * GET /api/skills/[name]/files/[...path] — read a single file content
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { name, path: pathSegments } = await params;
  const resolved = resolveParams(name, pathSegments);

  if (!resolved) {
    return Response.json(
      { error: 'Skill name and file path are required' },
      { status: 400 },
    );
  }

  // Verify skill exists
  const detail = await getSkillDetail(resolved.skillName);
  if (!detail) {
    return Response.json(
      { error: `Skill "${resolved.skillName}" not found` },
      { status: 404 },
    );
  }

  const content = await getSkillFileContentFromBlob(
    resolved.skillName,
    resolved.filePath,
  );
  if (content === null) {
    return Response.json(
      {
        error: `File "${resolved.filePath}" not found in skill "${resolved.skillName}"`,
      },
      { status: 404 },
    );
  }

  if (request.nextUrl.searchParams.get('download') === '1') {
    return new Response(content, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename="${resolved.filePath.split('/').at(-1) ?? 'skill-file'}"`,
      },
    });
  }

  return Response.json({ path: resolved.filePath, content });
}

const updateBodySchema = z.object({ content: z.string() });

/**
 * PUT /api/skills/[name]/files/[...path] — update a single file content
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const { name, path: pathSegments } = await params;
  const resolved = resolveParams(name, pathSegments);

  if (!resolved) {
    return Response.json(
      { error: 'Skill name and file path are required' },
      { status: 400 },
    );
  }

  const body = await request.json();
  const parsed = updateBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const updated = await updateSkillFile(
    resolved.skillName,
    resolved.filePath,
    parsed.data.content,
  );
  return Response.json({ skill: updated, path: resolved.filePath });
}
