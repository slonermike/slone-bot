// Usage: npm run dev:proto -- <slug>   (serves one prototype with hot reload on :5173)
import { createServer } from 'vite';
import { protoConfig } from './vite-configs.mjs';

const slug = process.argv[2];
if (!slug) {
  console.error('usage: npm run dev:proto -- <slug>');
  process.exit(1);
}
const server = await createServer({ ...protoConfig(slug, 'dist'), server: { port: 5173, fs: { allow: [process.cwd()] } } });
await server.listen();
server.printUrls();
