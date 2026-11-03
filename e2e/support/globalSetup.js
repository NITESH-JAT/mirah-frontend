import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { STATE_FILE, backendDir, backendEnv } from './env.js';

/** Starts mira-backend's E2E server (background jobs off, emails captured) and seeds a customer + manufacturer. */
export default async function globalSetup() {
  if (process.env.E2E_ALLOW_DB !== 'dev') {
    throw new Error('Browser E2E writes to the database. Set E2E_ALLOW_DB=dev to confirm the target is not production.');
  }
  const runId = `w${Date.now().toString(36)}`;
  const env = backendEnv(runId);
  const serve = spawn('node', ['-r', 'ts-node/register', 'e2e/serve.ts'], {
    cwd: backendDir(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let stderr = '';
  serve.stderr.on('data', (d) => (stderr += d));
  const ready = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`E2E backend did not start.\n${stderr}`)), 150_000);
    serve.stdout.on('data', (d) => {
      buf += d;
      const line = buf.split('\n').find((l) => l.trim().startsWith('{"apiUrl"'));
      if (line) {
        clearTimeout(timer);
        resolve(JSON.parse(line));
      }
    });
    serve.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`E2E backend exited (${code}).\n${stderr}`));
    });
  });
  serve.stdout.removeAllListeners('data');
  serve.stdout.resume();
  serve.unref();

  const seeded = JSON.parse(
    execFileSync('node', ['-r', 'ts-node/register', 'e2e/seed.ts', 'create'], { cwd: backendDir(), env, encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter((l) => l.startsWith('{'))
      .pop(),
  );
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ runId, servePid: serve.pid, ...ready, ...seeded }, null, 2));
}
