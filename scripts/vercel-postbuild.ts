import { spawn } from 'node:child_process';

function isVercelProductionBuild() {
  return (
    process.env.VERCEL === '1' &&
    (process.env.VERCEL_ENV === 'production' ||
      process.env.VERCEL_TARGET_ENV === 'production')
  );
}

function runScript(scriptName: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('bun', ['run', scriptName], {
      env: process.env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`bun run ${scriptName} exited with code ${code}`));
    });
  });
}

if (!isVercelProductionBuild()) {
  console.log('[postbuild] skipping database push outside Vercel production');
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  throw new Error('[postbuild] DATABASE_URL is required in production');
}

console.log('[postbuild] ensuring pgvector extension');
await runScript('db:ensure-vector');

console.log('[postbuild] pushing Drizzle schema');
await runScript('db:push');

console.log('[postbuild] database schema is up to date');
