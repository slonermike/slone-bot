// Runs on `npm install` (prepare): point git at .githooks so the secret check runs pre-commit. Never fails the install.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
try {
  if (fs.existsSync('.git') && fs.existsSync('.githooks')) execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
} catch { /* not a git checkout (CI tarball etc.) */ }
