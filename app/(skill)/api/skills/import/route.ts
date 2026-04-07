import { randomUUID } from 'node:crypto';

import { after } from 'next/server';
import { z } from 'zod';

import { rm } from 'node:fs/promises';

import {
  cloneRepoToTmp,
  normalizeGitURL,
  scanSkillsFromRepo,
  syncSkillFilesToBlob,
} from '@/lib/core/blob/skills';
import {
  createImportJob,
  getActiveImportJobForRepo,
  getImportJob,
  updateImportJob,
} from '@/lib/core/kv/import-jobs';
import { withKvLock } from '@/lib/core/kv/lock';
import {
  findConflictingSkillNames,
  getActiveImportJobs,
  syncRepoSkillDetails,
} from '@/lib/core/kv/skills';

export const runtime = 'nodejs';

const IMPORT_TIMEOUT_MS = 2 * 60 * 1000;

const importInputSchema = z.object({
  gitURL: z.string().url('A valid HTTPS git URL is required'),
});

/**
 * GET /api/skills/import?jobId=xxx — poll background job status
 * GET /api/skills/import — return all active import jobs
 */
export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get('jobId');

  // If no jobId, return all active jobs
  if (!jobId) {
    const activeJobs = await getActiveImportJobs();
    return Response.json(activeJobs);
  }

  // Existing logic: fetch specific job by jobId
  const job = await getImportJob(jobId);
  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }
  return Response.json(job);
}

/**
 * POST /api/skills/import — enqueues a git import; returns 202 immediately.
 * The actual clone + sync runs in the background via after().
 */
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = importInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const gitURL = normalizeGitURL(parsed.data.gitURL);
  const existingJob = await getActiveImportJobForRepo(gitURL);
  if (existingJob) {
    return Response.json(existingJob, { status: 202 });
  }

  const jobId = randomUUID();
  await createImportJob(jobId, gitURL, gitURL);

  after(async () => {
    try {
      await withKvLock(
        `skills-import:${gitURL}`,
        async () => {
          await updateImportJob(jobId, { status: 'cloning', error: '' });

          const cloned = await Promise.race([
            cloneRepoToTmp(gitURL),
            new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(new Error('Skill import timed out during clone.'));
              }, IMPORT_TIMEOUT_MS);
            }),
          ]);

          try {
            const scannedSkills = await scanSkillsFromRepo(
              cloned.repoDir,
              gitURL,
            );
            const skillNames = scannedSkills.map((s) => s.detail.name);

            // Check for cross-repo name conflicts
            const conflicts = await findConflictingSkillNames(
              skillNames,
              gitURL,
            );
            if (conflicts.length > 0) {
              throw new Error(
                `Cannot import: skill(s) "${conflicts.join('", "')}" already exist from a different source. Please delete them first or rename the skills in the repository.`,
              );
            }

            await updateImportJob(jobId, { status: 'syncing' });

            // Upload files to Blob
            for (const skill of scannedSkills) {
              await syncSkillFilesToBlob(
                skill.detail.name,
                skill.localDir,
                skill.filePaths,
              );
            }

            // Sync to KV
            const synced = await syncRepoSkillDetails(
              gitURL,
              scannedSkills.map((s) => s.detail),
            );

            await updateImportJob(jobId, {
              status: 'done',
              importedNames: synced.imported.map((s) => s.name),
              removedNames: synced.removed,
              fileCount: synced.imported.reduce(
                (sum, skill) => sum + skill.files.length,
                0,
              ),
              finishedAt: Date.now(),
            });
          } finally {
            await rm(cloned.tempDir, { recursive: true, force: true });
          }
        },
        {
          ttlMs: IMPORT_TIMEOUT_MS,
          acquireTimeoutMs: 2_000,
        },
      );
    } catch (err) {
      await updateImportJob(jobId, {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        finishedAt: Date.now(),
      });
    }
  });

  return Response.json({ jobId, status: 'pending', gitURL }, { status: 202 });
}
