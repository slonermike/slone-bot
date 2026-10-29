#!/usr/bin/env node
// Fails on obvious secret patterns, tracked .env files, and personal email addresses.
//   node scripts/check-secrets.mjs            scan tracked + untracked-but-not-ignored files
//   node scripts/check-secrets.mjs --staged   scan only staged content (pre-commit)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PATTERNS = [
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Anthropic/OpenAI style key', /\bsk-(ant-)?[A-Za-z0-9_-]{32,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Private key block', /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['Hard-coded credential', /\b(api[_-]?key|secret|token|passw(or)?d)\b\s*[:=]\s*['"][A-Za-z0-9/+_=-]{16,}['"]/i],
  ['Credentialed URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]{3,}@[^\s/]+/i],
];
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const EMAIL_OK = /(noreply|no-reply)@|@example\.(com|org)$|@users\.noreply\.github\.com$|@anthropic\.com$/i;
const SKIP_EXT = /\.(png|jpg|jpeg|gif|webp|woff2?|ttf|wasm|ico|zip|gz|mp3|wav|ogg)$/i;
const SKIP_PATH = /(^|\/)(node_modules|dist|dist-site|site-out|package-lock\.json)(\/|$)/;

/** Scan text; returns findings [{rule, line, snippet}]. Exported for tests. */
export function scanText(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.length > 4000) return;
    for (const [rule, re] of PATTERNS) if (re.test(line)) out.push({ rule, line: i + 1, snippet: line.trim().slice(0, 60) });
    for (const m of line.matchAll(EMAIL)) if (!EMAIL_OK.test(m[0])) out.push({ rule: 'Email address (personal data?)', line: i + 1, snippet: m[0] });
  });
  return out;
}

function listFiles(staged) {
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  try {
    return staged ? git('diff', '--cached', '--name-only', '--diff-filter=ACM') : [...new Set([...git('ls-files'), ...git('ls-files', '-o', '--exclude-standard')])];
  } catch {
    return [];
  }
}

function main() {
  const staged = process.argv.includes('--staged');
  const findings = [];
  for (const rel of listFiles(staged)) {
    if (SKIP_PATH.test(rel) || SKIP_EXT.test(rel)) continue;
    if (/(^|\/)\.env(\.|$)/.test(rel) && !/\.env\.example$/.test(rel)) { findings.push({ file: rel, rule: 'env file must not be committed', line: 0, snippet: '' }); continue; }
    let text;
    try {
      text = staged ? execFileSync('git', ['show', `:${rel}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20e6 }) : fs.readFileSync(path.join(ROOT, rel), 'utf8');
    } catch { continue; }
    if (text.includes('\0')) continue;
    for (const f of scanText(text)) findings.push({ file: rel, ...f });
  }
  if (findings.length) {
    console.error(`secret check FAILED (${findings.length}):`);
    for (const f of findings.slice(0, 30)) console.error(`  ${f.file}:${f.line}  ${f.rule}  ${f.snippet}`);
    process.exit(1);
  }
  console.log(`secret check ok (${staged ? 'staged files' : 'all files'})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
