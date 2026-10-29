// Generated-entry template: vite aliases `@proto` to src/protos/<slug>/index.ts for each prototype build.
import * as mod from '@proto';
import { startPrototype } from '../shell.ts';
import type { PrototypeModule } from '../types.ts';

startPrototype(mod as PrototypeModule).catch((e) => {
  document.body.innerHTML = `<pre style="color:#f88;padding:24px;font:16px monospace">Boot failed: ${String(e)}</pre>`;
  console.error(e);
});
