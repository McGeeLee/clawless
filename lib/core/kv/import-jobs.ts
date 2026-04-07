import { get, set } from '@/lib/core/kv';
import {
  addActiveImportJob,
  removeActiveImportJob,
  updateActiveImportJobStatus,
} from './skills';

export type ImportJobStatus =
  | 'pending'
  | 'cloning'
  | 'syncing'
  | 'done'
  | 'error';

export interface ImportJob {
  jobId: string;
  gitURL: string;
  repoKey: string;
  status: ImportJobStatus;
  importedNames: string[];
  removedNames: string[];
  error: string;
  fileCount: number;
  totalBytes: number;
  startedAt: number;
  finishedAt: number;
}

const JOB_TTL_SECONDS = 3600; // 1 hour

function jobKey(jobId: string): string {
  return `skills:import-job:${jobId}`;
}

function repoJobKey(repoKey: string): string {
  return `skills:import-job:repo:${encodeURIComponent(repoKey)}`;
}

export async function createImportJob(
  jobId: string,
  gitURL: string,
  repoKey: string,
): Promise<ImportJob> {
  const job: ImportJob = {
    jobId,
    gitURL,
    repoKey,
    status: 'pending',
    importedNames: [],
    removedNames: [],
    error: '',
    fileCount: 0,
    totalBytes: 0,
    startedAt: Date.now(),
    finishedAt: 0,
  };
  await set(jobKey(jobId), JSON.stringify(job), { ex: JOB_TTL_SECONDS });
  await set(repoJobKey(repoKey), jobId, { ex: JOB_TTL_SECONDS });

  // Sync to SkillIndex
  await addActiveImportJob({
    jobId,
    gitURL,
    status: 'pending',
    startedAt: job.startedAt,
  });

  return job;
}

export async function updateImportJob(
  jobId: string,
  update: Partial<Omit<ImportJob, 'jobId'>>,
): Promise<void> {
  const raw = await get(jobKey(jobId));
  if (!raw) return;
  const existing: ImportJob =
    typeof raw === 'string' ? JSON.parse(raw) : (raw as ImportJob);
  const updated: ImportJob = { ...existing, ...update };
  await set(jobKey(jobId), JSON.stringify(updated), { ex: JOB_TTL_SECONDS });

  // Sync status changes to SkillIndex
  if (update.status) {
    if (update.status === 'done' || update.status === 'error') {
      // When job is done or failed, remove it from active list
      await removeActiveImportJob(jobId);
    } else if (
      update.status === 'pending' ||
      update.status === 'cloning' ||
      update.status === 'syncing'
    ) {
      // Update active job status
      await updateActiveImportJobStatus(jobId, update.status);
    }
  }
}

export async function getImportJob(jobId: string): Promise<ImportJob | null> {
  const raw = await get(jobKey(jobId));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : (raw as ImportJob);
}

export async function getActiveImportJobForRepo(
  repoKey: string,
): Promise<ImportJob | null> {
  const rawJobId = await get(repoJobKey(repoKey));
  const jobId =
    typeof rawJobId === 'string' ? rawJobId : (rawJobId as string | undefined);

  if (!jobId) {
    return null;
  }

  const job = await getImportJob(jobId);
  if (!job) {
    return null;
  }

  if (
    job.status === 'pending' ||
    job.status === 'cloning' ||
    job.status === 'syncing'
  ) {
    return job;
  }

  return null;
}
