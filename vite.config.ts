// `npm run dev` serves the launcher; `PROTO=<slug> npm run dev` serves one prototype.
// Production builds go through scripts/build-site.mjs (same configs).
import { defineConfig } from 'vite';
import { launcherConfig, protoConfig } from './scripts/vite-configs.mjs';

const proto = process.env.PROTO;
const cfg = proto ? protoConfig(proto, 'dist') : launcherConfig('dist-site');
export default defineConfig({ ...cfg, configFile: undefined } as never);
