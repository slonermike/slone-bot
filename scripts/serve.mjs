// Usage: npm run serve   (serves dist-site on :4173 after `npm run build:site`)
import { serveDir } from '../tests/lib/server.mjs';
const { url } = await serveDir(process.argv[2] ?? 'dist-site', 4173);
console.log(`serving ${url}`);
