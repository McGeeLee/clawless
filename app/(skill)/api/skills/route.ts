import {
  checkSkillNameExists,
  listSkillMetas,
  persistManualSkill,
} from '@/lib/core/kv/skills';
import { z } from 'zod';

const skillFileSchema = z.object({
  path: z.string().min(1, 'File path is required'),
  content: z.string(),
});

const manualInputSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  description: z.string().default(''),
  files: z.array(skillFileSchema).min(1, 'At least one file is required'),
});

/**
 * GET /api/skills — list all skills (meta summaries)
 */
export async function GET() {
  const metas = await listSkillMetas();
  return Response.json(metas);
}

/**
 * POST /api/skills — manually create a skill with files
 */
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = manualInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const exists = await checkSkillNameExists(parsed.data.name);
  if (exists) {
    return Response.json(
      {
        error: `Skill "${parsed.data.name.trim()}" already exists. Please choose a different name or delete the existing skill first.`,
      },
      { status: 409 },
    );
  }

  const detail = await persistManualSkill({
    name: parsed.data.name,
    description: parsed.data.description,
    files: parsed.data.files,
  });

  return Response.json(detail);
}
