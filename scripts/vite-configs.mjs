// Shared Vite configs: launcher (site root) and per-prototype builds (/p/<slug>/).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Launcher: src/launcher -> <out>/. Does not empty <out> so p/ survives. */
export function launcherConfig(outDir) {
  return {
    configFile: false,
    root: path.join(ROOT, 'src/launcher'),
    base: './',
    publicDir: false,
    logLevel: 'warn',
    build: { outDir, emptyOutDir: false, target: 'es2022', chunkSizeWarningLimit: 900 },
    server: { fs: { allow: [ROOT] } },
  };
}

/** One prototype: the shell entry with `@proto` aliased to src/protos/<slug>/index.ts. */
export function protoConfig(slug, outDir) {
  return {
    configFile: false,
    root: path.join(ROOT, 'src/core/shell'),
    base: './',
    publicDir: false,
    logLevel: 'warn',
    resolve: { alias: { '@proto': path.join(ROOT, 'src/protos', slug, 'index.ts') } },
    build: { outDir, emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 2500 },
    server: { fs: { allow: [ROOT] } },
  };
}
