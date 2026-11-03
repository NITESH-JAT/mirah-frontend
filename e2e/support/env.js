import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const STATE_FILE = path.join(here, '..', '.results', 'e2e-state.json');

export const backendDir = () => path.resolve(process.env.E2E_BACKEND_DIR || path.join(here, '..', '..', '..', 'mira-backend'));

export function backendEnv(runId) {
  return {
    ...process.env,
    E2E_ALLOW_DB: 'dev',
    E2E_PORT: String(process.env.E2E_PORT || 9101),
    E2E_RUN_ID: runId,
    E2E_API_URL: `http://127.0.0.1:${process.env.E2E_PORT || 9101}`,
    TS_NODE_TRANSPILE_ONLY: 'true',
  };
}
