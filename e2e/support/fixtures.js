import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { STATE_FILE, backendDir, backendEnv } from './env.js';

export { expect };

export const state = () => JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

/** JSON call against the E2E backend; never throws on HTTP errors. */
export async function api(method, path, { token, body, admin } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${state().apiUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  void admin;
  return { status: res.status, body: json };
}

/** Fresh login through the API, returning the stored-session object the app keeps in localStorage. */
export async function apiLogin(user) {
  const res = await api('POST', '/api/user/auth/login', { body: { type: 'email', email: user.email, password: user.password } });
  const data = res.body?.data;
  if (!data?.token) throw new Error(`Login failed for ${user.email}: ${res.status} ${res.body?.message}`);
  const userObj = data.user || data;
  return { ...userObj, token: data.token };
}

/** Signs the browser in the way authService.login does (mirah_session_user in localStorage). */
export async function signIn(page, user) {
  const session = await apiLogin(user);
  await page.goto('/login');
  await page.evaluate((s) => localStorage.setItem('mirah_session_user', JSON.stringify(s)), session);
  return session;
}

let adminTokenCache = null;
function adminCreds() {
  let email = process.env.E2E_ADMIN_EMAIL || '';
  let password = process.env.E2E_ADMIN_PASSWORD || '';
  const file = process.env.E2E_USERS_FILE;
  if ((!email || !password) && file && fs.existsSync(file)) {
    const m = /admin:[\s\S]*?email\s*:\s*(\S+)[\s\S]*?password\s*:\s*(\S+)/i.exec(fs.readFileSync(file, 'utf8'));
    if (m) [email, password] = [email || m[1], password || m[2]];
  }
  return { email, password };
}

export async function adminToken() {
  if (adminTokenCache) return adminTokenCache;
  const creds = adminCreds();
  if (!creds.email) throw new Error('Set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD or E2E_USERS_FILE');
  const res = await api('POST', '/api/admin/auth/login', { body: creds });
  adminTokenCache = res.body?.data?.token ?? res.body?.token;
  if (!adminTokenCache) throw new Error(`Admin login failed: ${res.status}`);
  return adminTokenCache;
}

/** Promo codes must start with E2E<RUNID> so the backend cleanup removes them. */
export function promoCode(suffix) {
  return `E2E${state().runId.toUpperCase()}${suffix}`.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 40);
}

export async function createPromo(def) {
  const res = await api('POST', '/api/admin/promo-codes', { token: await adminToken(), body: { isActive: true, ...def } });
  if (res.status !== 201) throw new Error(`Promo create failed: ${res.status} ${res.body?.message}`);
  return res.body.data;
}

/** Inserts projects in given states for a seeded user (see mira-backend/e2e/web/seedProjects.ts). */
export function seedProjects(spec) {
  const out = execFileSync('node', ['-r', 'ts-node/register', 'e2e/web/seedProjects.ts', JSON.stringify(spec)], {
    cwd: backendDir(),
    env: backendEnv(state().runId),
    encoding: 'utf8',
  });
  return JSON.parse(out.trim().split('\n').filter((l) => l.startsWith('{')).pop());
}

/** Creates a fresh, verified user straight in the DB (no OTP) for tests that need their own account. */
export function createUser(kind) {
  const out = execFileSync(
    'node',
    ['-r', 'ts-node/register', '-e', `
      const f = require('./e2e/support/fixtures');
      f.createUser(${JSON.stringify(kind)}, { label: 'web-extra' })
        .then((u) => { process.stdout.write(JSON.stringify(u) + '\\n'); return f.closeDb(); })
        .catch((e) => { console.error(e.message); process.exit(1); });`],
    { cwd: backendDir(), env: backendEnv(state().runId), encoding: 'utf8' },
  );
  return JSON.parse(out.trim().split('\n').filter((l) => l.startsWith('{')).pop());
}

/** Visible text of the page, for wording checks. */
export const visibleText = (page) => page.evaluate(() => document.body.innerText);

export const test = base.extend({
  isPhone: async ({ viewport }, use) => use((viewport?.width || 1440) < 768),
});
