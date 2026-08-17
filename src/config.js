import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
// DATA_DIR env override lets hosted deployments point at a mounted disk
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
export const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');

fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

// Load .env (tiny built-in loader, no dependency needed)
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override) || typeof base !== 'object' || typeof override !== 'object' || !base || !override) {
    return override === undefined ? base : override;
  }
  const out = { ...base };
  for (const k of Object.keys(override)) out[k] = deepMerge(base[k], override[k]);
  return out;
}

const defaults = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'default.json'), 'utf8'));
const localPath = path.join(ROOT, 'config', 'local.json');
const local = fs.existsSync(localPath) ? JSON.parse(fs.readFileSync(localPath, 'utf8')) : {};

export const config = deepMerge(defaults, local);

// Env-var overrides for Sunbiz SFTP
if (process.env.SUNBIZ_SFTP_HOST) config.sunbiz.sftp.host = process.env.SUNBIZ_SFTP_HOST;
if (process.env.SUNBIZ_SFTP_USER) config.sunbiz.sftp.user = process.env.SUNBIZ_SFTP_USER;
if (process.env.SUNBIZ_SFTP_PASSWORD) config.sunbiz.sftp.password = process.env.SUNBIZ_SFTP_PASSWORD;

// API keys arrive by copy-paste into hosting dashboards — trailing newlines,
// spaces, and wrapping quotes are the #1 cause of mystery 401/403s. Sanitize
// them in place (some consumers, like the Anthropic SDK, read process.env
// directly) and say so, so a dirty paste fixes itself on the next boot.
for (const name of [
  'ANTHROPIC_API_KEY', 'APOLLO_API_KEY', 'HUNTER_API_KEY', 'ZEROBOUNCE_API_KEY',
  'SERPER_API_KEY', 'SCRAPEGRAPHAI_API_KEY', 'SAM_API_KEY', 'CENSUS_API_KEY',
]) {
  const raw = process.env[name];
  if (!raw) continue;
  const cleaned = raw.trim().replace(/^["']+|["']+$/g, '');
  if (cleaned !== raw) {
    process.env[name] = cleaned;
    console.log(`[config] ${name} contained whitespace/quotes from a paste — auto-cleaned`);
  }
}

export const providers = {
  apollo: process.env.APOLLO_API_KEY || null,
  hunter: process.env.HUNTER_API_KEY || null,
  zerobounce: process.env.ZEROBOUNCE_API_KEY || null,
  serper: process.env.SERPER_API_KEY || null,
  scrapegraph: process.env.SCRAPEGRAPHAI_API_KEY || null,
};
