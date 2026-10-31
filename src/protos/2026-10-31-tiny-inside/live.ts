import type { Sim } from './sim.ts';
// The bots read the running sim through this handle (they run the sim headless, in the same module graph).
export const live: { sim: Sim | null } = { sim: null };
