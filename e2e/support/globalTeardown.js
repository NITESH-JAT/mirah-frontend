import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { STATE_FILE, backendDir, backendEnv } from './env.js';

export default async function globalTeardown() {
  if (!fs.existsSync(STATE_FILE)) return;
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  try {
    process.kill(-state.servePid, 'SIGTERM');
  } catch {
    // already gone
  }
  if (process.env.E2E_KEEP_DATA !== 'true') {
    execFileSync('node', ['-r', 'ts-node/register', 'e2e/seed.ts', 'cleanup'], {
      cwd: backendDir(),
      env: backendEnv(state.runId),
      stdio: 'inherit',
    });
  }
  fs.rmSync(STATE_FILE, { force: true });
}
